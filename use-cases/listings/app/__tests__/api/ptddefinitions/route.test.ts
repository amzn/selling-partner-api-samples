import "isomorphic-fetch";
import { GET } from "@/app/api/ptddefinitions/route";
import { mock, instance, when, reset } from "ts-mockito";
import { getSettings } from "@/app/api/settings/wrapper";
import getSPAPIEndpoint, {
  buildDefinitionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { DefinitionsApi } from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { headers } from "next/dist/client/components/headers";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import fetch from "jest-fetch-mock";
import { afterEach } from "@jest/globals";
import {
  CREATE_OFFER_USE_CASE,
  LOCALE_HEADER,
  PRODUCT_TYPE_HEADER,
  USE_CASE_HEADER,
} from "@/app/constants/global";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";

const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";
const MOCK_PTD_DEFINITION = {
  schema: {
    link: {
      resource: "https://schemalink.com",
      verb: "GET",
    },
    checksum: "",
  },
  requirements: "LISTING",
  propertyGroups: [],
};
const MOCK_SCHEMA = {
  id: "schema",
};

const LUGGAGE_PTD = "LUGGAGE";
const US_LOCALE = "en_US";
const INVALID_USE_CASE = "Create";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

const mockedGetDefinitionsProductType = jest.fn();
const definitionsApi: DefinitionsApi = new DefinitionsApi(undefined);
definitionsApi.getDefinitionsProductType = mockedGetDefinitionsProductType;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildDefinitionsAPIClient = jest.mocked(buildDefinitionsAPIClient);
mockedBuildDefinitionsAPIClient.mockResolvedValue(definitionsApi);
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

function mockHeaders(productType?: string, locale?: string, useCase?: string) {
  productType &&
    when(mockReadOnlyHeaders.get(PRODUCT_TYPE_HEADER)).thenReturn(productType);
  locale && when(mockReadOnlyHeaders.get(LOCALE_HEADER)).thenReturn(locale);
  useCase && when(mockReadOnlyHeaders.get(USE_CASE_HEADER)).thenReturn(useCase);
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockPTDDefinition(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedGetDefinitionsProductType.mockRejectedValue(error);
  } else {
    mockedGetDefinitionsProductType.mockResolvedValue(MOCK_PTD_DEFINITION);
  }
}

describe("Test GET ptddefinitions API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful retrieval of schema", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, US_LOCALE, CREATE_OFFER_USE_CASE);
    mockPTDDefinition();
    mockResolveFetchResponse(200, MOCK_SCHEMA);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on successful retrieval of schema with default locale", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, undefined, CREATE_OFFER_USE_CASE);
    mockPTDDefinition();
    mockResolveFetchResponse(200, MOCK_SCHEMA);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on settings fetch failure", async () => {
    mockSettings(500);
    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 400 on missing product type in headers", async () => {
    mockSettings(200);
    mockHeaders(undefined, US_LOCALE, CREATE_OFFER_USE_CASE);
    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 400 on missing use case in headers", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, US_LOCALE, undefined);
    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 400 on unrecognized use case in headers", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, US_LOCALE, INVALID_USE_CASE);
    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 404 on failure making call to the GetDefinitionsProductType API", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, US_LOCALE, CREATE_OFFER_USE_CASE);
    mockPTDDefinition({
      status: 404,
    });
    await verifyStatusAndBody(await GET(), 404, true);
  });

  test("returns 500 on failure to download the schema from schema link", async () => {
    mockSettings(200);
    mockHeaders(LUGGAGE_PTD, US_LOCALE, CREATE_OFFER_USE_CASE);
    mockPTDDefinition();
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await GET(), 500, true);
  });
});
