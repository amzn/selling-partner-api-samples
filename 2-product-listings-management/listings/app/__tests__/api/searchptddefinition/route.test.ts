import { DefinitionsApi } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import getSPAPIEndpoint, {
  buildDefinitionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { getSettings } from "@/app/api/settings/wrapper";
import { headers } from "next/dist/client/components/headers";
import fetch from "jest-fetch-mock";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";

import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { mock, instance, when, reset } from "ts-mockito";
import { KEYWORDS_HEADER } from "@/app/constants/global";
import { GET } from "@/app/api/searchptddefinition/route";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";

const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";
const MOCK_PRODUCT_TYPES = {
  productTypes: [
    {
      name: "3D_PRINTER",
      displayName: "3D  Printer",
      marketplaceIds: ["ATVPDKIKX0DER"],
    },
    {
      name: "INKJET_PRINTER_INK",
      displayName: "Inkjet Printer Ink",
      marketplaceIds: ["ATVPDKIKX0DER"],
    },
    {
      name: "LASER_PRINTER_TONER",
      displayName: "Laser Printer Toner",
      marketplaceIds: ["ATVPDKIKX0DER"],
    },
    {
      name: "PRINTER",
      displayName: "Printer",
      marketplaceIds: ["ATVPDKIKX0DER"],
    },
  ],
  productTypeVersion: "UAAAAAAAAAAAAAAAAlYD0upa77EPI-kJKcBPTGLHMFGXMhvA=",
};

const KEYWORDS = "PRINTER";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);
const mockedSearchDefinitionsProductTypes = jest.fn();
const definitionApi: DefinitionsApi = new DefinitionsApi(undefined);
definitionApi.searchDefinitionsProductTypes =
  mockedSearchDefinitionsProductTypes;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildDefinitionsAPIClient = jest.mocked(buildDefinitionsAPIClient);
mockedBuildDefinitionsAPIClient.mockResolvedValue(definitionApi);
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

function mockHeaders(keywords?: string) {
  keywords &&
    when(mockReadOnlyHeaders.get(KEYWORDS_HEADER)).thenReturn(keywords);
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockSearchPTDDefinition(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedSearchDefinitionsProductTypes.mockRejectedValue(error);
  } else {
    mockedSearchDefinitionsProductTypes.mockResolvedValue(MOCK_PRODUCT_TYPES);
  }
}

describe("Test Search Definitions Product Types API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("Returns 200 on successful search Product Types", async () => {
    mockSettings(200);
    mockHeaders(KEYWORDS);
    mockSearchPTDDefinition();

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on settings fetch failure", async () => {
    mockSettings(500);
    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 500 on failure making call to the Search Product Types API", async () => {
    mockSettings(200);
    mockHeaders(KEYWORDS);
    mockSearchPTDDefinition({
      status: 500,
    });
    await verifyStatusAndBody(await GET(), 500, true);
  });

  test("returns 404 on failure making call to the Search Product Types API", async () => {
    mockSettings(200);
    mockHeaders(KEYWORDS);
    mockSearchPTDDefinition({
      status: 404,
    });
    await verifyStatusAndBody(await GET(), 404, true);
  });
});
