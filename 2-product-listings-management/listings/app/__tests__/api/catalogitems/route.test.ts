import "isomorphic-fetch";
import { GET } from "@/app/api/catalogitems/route";
import { mock, instance, when, reset } from "ts-mockito";
import { getSettings } from "@/app/api/settings/wrapper";
import getSPAPIEndpoint, {
  buildCatalogItemsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { headers } from "next/dist/client/components/headers";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import fetch from "jest-fetch-mock";
import { afterEach } from "@jest/globals";
import {
  IDENTIFIER_TYPES_HEADER,
  IDENTIFIERS_HEADER,
  KEYWORDS_HEADER,
  LOCALE_HEADER,
} from "@/app/constants/global";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import { CatalogApi } from "@/app/sdk/catalogItems_2022-04-01";
import {
  MOCK_CATALOG_ITEMS_API_EMPTY_RESPONSE,
  MOCK_CATALOG_ITEMS_API_RESPONSE,
} from "@/app/test-utils/mock-catalog-items-result";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";

const IDENTIFIERS = "B00004SPEC";
const ASIN_IDENTIFIERS_TYPE = "ASIN";
const SKU_IDENTIFIERS_TYPE = "SKU";
const KEYWORDS = "SHIRT";
const US_LOCALE = "en_US";
const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

const mockedSearchCatalogItems = jest.fn();
const catalogApi: CatalogApi = new CatalogApi(undefined);
catalogApi.searchCatalogItems = mockedSearchCatalogItems;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildCatalogAPIClient = jest.mocked(buildCatalogItemsAPIClient);
mockedBuildCatalogAPIClient.mockResolvedValue(catalogApi);
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

function mockHeaders(
  identifiers?: string,
  keywords?: string,
  identifiersType?: string,
  locale?: string,
) {
  identifiers &&
    when(mockReadOnlyHeaders.get(IDENTIFIERS_HEADER)).thenReturn(identifiers);
  keywords &&
    when(mockReadOnlyHeaders.get(KEYWORDS_HEADER)).thenReturn(keywords);
  identifiersType &&
    when(mockReadOnlyHeaders.get(IDENTIFIER_TYPES_HEADER)).thenReturn(
      identifiersType,
    );
  locale && when(mockReadOnlyHeaders.get(LOCALE_HEADER)).thenReturn(locale);
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockSearchCatalogItems(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedSearchCatalogItems.mockRejectedValue(error);
  } else {
    mockedSearchCatalogItems.mockResolvedValue(MOCK_CATALOG_ITEMS_API_RESPONSE);
  }
}

describe("Test GET catalogItems API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful call to Search Catalog API", async () => {
    mockSettings(200);
    mockHeaders(IDENTIFIERS, undefined, ASIN_IDENTIFIERS_TYPE, US_LOCALE);
    mockSearchCatalogItems();
    mockResolveFetchResponse(200, MOCK_CATALOG_ITEMS_API_RESPONSE);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on successful call to Search Catalog API with empty response", async () => {
    mockSettings(200);
    mockHeaders(IDENTIFIERS, undefined, ASIN_IDENTIFIERS_TYPE, US_LOCALE);
    mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
    mockedSearchCatalogItems.mockResolvedValue(
      MOCK_CATALOG_ITEMS_API_EMPTY_RESPONSE,
    );
    mockResolveFetchResponse(200, MOCK_CATALOG_ITEMS_API_EMPTY_RESPONSE);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on successful call to Search Catalog API for SKU Identifiers", async () => {
    mockSettings(200);
    mockHeaders(IDENTIFIERS, "", SKU_IDENTIFIERS_TYPE, US_LOCALE);
    mockSearchCatalogItems();
    mockResolveFetchResponse(200, MOCK_CATALOG_ITEMS_API_RESPONSE);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on successful call to Search Catalog API for keywords", async () => {
    mockSettings(200);
    mockHeaders(undefined, KEYWORDS, SKU_IDENTIFIERS_TYPE, US_LOCALE);
    mockSearchCatalogItems();
    mockResolveFetchResponse(200, MOCK_CATALOG_ITEMS_API_RESPONSE);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on exception from settings response when calling Search Catalog API", async () => {
    mockSettings(500);
    mockHeaders(IDENTIFIERS, "", ASIN_IDENTIFIERS_TYPE, US_LOCALE);
    mockSearchCatalogItems();
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 404 on exception from Search Catalog API", async () => {
    mockSettings(200);
    mockHeaders(undefined, undefined, undefined, US_LOCALE);
    mockSearchCatalogItems({
      status: 404,
    });
    mockRejectFetchResponse(404);

    await verifyStatusAndBody(await GET(), 404, true);
  });
});
