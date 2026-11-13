import { ListingsApi as ListingsRestrictionsApi } from "@/app/sdk/listingsRestrictions_2021-08-01";
import getSPAPIEndpoint, {
  buildListingsRestrictionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { getSettings } from "@/app/api/settings/wrapper";
import { headers } from "next/dist/client/components/headers";
import fetch from "jest-fetch-mock";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { mock, instance, when, reset } from "ts-mockito";
import { ASIN_HEADER, LOCALE_HEADER } from "@/app/constants/global";
import { GET } from "@/app/api/conditiontypes/route";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";

const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";

const MOCK_RESTRICTION = {
  restrictions: [
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "new_new",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "new_open_box",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "new_oem",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "refurbished_refurbished",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "used_like_new",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "used_very_good",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "used_good",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "used_acceptable",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "collectible_like_new",
      reasons: [],
    },
    {
      marketplaceId: "ATVPDKIKX0DER",
      conditionType: "collectible_very_good",
      reasons: [],
    },
  ],
};

const ASIN = "B09TT8GZK9";
const US_LOCALE = "en_US";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

const mockedGetListingsRestrictions = jest.fn();
const restrictionsApi: ListingsRestrictionsApi = new ListingsRestrictionsApi(
  undefined,
);
restrictionsApi.getListingsRestrictions = mockedGetListingsRestrictions;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildRestrictionsAPIClient = jest.mocked(
  buildListingsRestrictionsAPIClient,
);
mockedBuildRestrictionsAPIClient.mockResolvedValue(restrictionsApi);
const mockedGetSPAPIEndpoint = jest.mocked(getSPAPIEndpoint);

jest.mock("@/app/api/settings/wrapper");
const mockedGetSettings = jest.mocked(getSettings);

jest.mock("next/dist/client/components/headers");
const mockedHeaders = jest.mocked(headers);

function mockSettings(status: number) {
  mockedGetSettings.mockResolvedValue({
    status: status,
    statusText: "Some Status Text",
    settings: MOCK_SETTINGS,
  });
}

function mockHeaders(asin?: string, locale?: string) {
  asin && when(mockReadOnlyHeaders.get(ASIN_HEADER)).thenReturn(asin);
  locale && when(mockReadOnlyHeaders.get(LOCALE_HEADER)).thenReturn(locale);
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockRestriction(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedGetListingsRestrictions.mockRejectedValue(error);
  } else {
    mockedGetListingsRestrictions.mockResolvedValue(MOCK_RESTRICTION);
  }
}
describe("Test GET conditiontypes API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("Returns 200 on successful retrieval of allowed Condition Types", async () => {
    mockSettings(200);
    mockHeaders(ASIN, US_LOCALE);
    mockRestriction();

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on settings fetch failure", async () => {
    mockSettings(500);
    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 400 on missing asin in headers", async () => {
    mockSettings(200);
    mockHeaders(undefined, US_LOCALE);
    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 404 on failure making call to the GetRestrictions API", async () => {
    mockSettings(200);
    mockHeaders(ASIN, US_LOCALE);
    mockRestriction({
      status: 404,
    });
    await verifyStatusAndBody(await GET(), 404, true);
  });
});
