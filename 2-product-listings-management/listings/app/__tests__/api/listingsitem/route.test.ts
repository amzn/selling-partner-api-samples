import "isomorphic-fetch";
import { DELETE, GET, POST } from "@/app/api/listingsitem/route";
import { mock, instance, when, reset } from "ts-mockito";
import { getSettings } from "@/app/api/settings/wrapper";
import getSPAPIEndpoint, {
  buildListingsItemsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { headers } from "next/dist/client/components/headers";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import fetch from "jest-fetch-mock";
import { afterEach } from "@jest/globals";
import {
  CREATE_OFFER_USE_CASE,
  LOCALE_HEADER,
  PRODUCT_TYPE_HEADER,
  SKU_HEADER,
  USE_CASE_HEADER,
} from "@/app/constants/global";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";
import { ListingsApi } from "@/app/sdk/listingsItems_2021-08-01";
import {
  MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
  MOCK_GET_LISTINGS_ITEM_API_EMPTY_SUMMARY_RESPONSE,
  MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
  MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
} from "@/app/test-utils/mock-listings-item-result";
import { NextRequest } from "next/server";
import { serializeToJsonString } from "@/app/utils/serialization";

const SKU = "sku";
const PRODUCT_TYPE = "productType";
const USE_CASE = CREATE_OFFER_USE_CASE;
const US_LOCALE = "en_US";
const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

const mockedGetListing = jest.fn();
const mockedDeleteListing = jest.fn();
const mockedPutListing = jest.fn();
const mockedPatchListing = jest.fn();

const listingsApi: ListingsApi = new ListingsApi(undefined);
listingsApi.getListingsItem = mockedGetListing;
listingsApi.deleteListingsItem = mockedDeleteListing;
listingsApi.putListingsItem = mockedPutListing;
listingsApi.patchListingsItem = mockedPatchListing;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildListingsApiClient = jest.mocked(buildListingsItemsAPIClient);
mockedBuildListingsApiClient.mockResolvedValue(listingsApi);
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
  sku?: string,
  locale?: string,
  productType?: string,
  useCase?: string,
) {
  sku && when(mockReadOnlyHeaders.get(SKU_HEADER)).thenReturn(sku);
  locale && when(mockReadOnlyHeaders.get(LOCALE_HEADER)).thenReturn(locale);
  productType &&
    when(mockReadOnlyHeaders.get(PRODUCT_TYPE_HEADER)).thenReturn(productType);
  useCase && when(mockReadOnlyHeaders.get(USE_CASE_HEADER)).thenReturn(useCase);
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockGetListingsItem(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedGetListing.mockRejectedValue(error);
  } else {
    mockedGetListing.mockResolvedValue(
      MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );
  }
}

function mockDeleteListingsItem(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedDeleteListing.mockRejectedValue(error);
  } else {
    mockedDeleteListing.mockResolvedValue(
      MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );
  }
}

function mockPutListingsItem(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedPutListing.mockRejectedValue(error);
  } else {
    mockedPutListing.mockResolvedValue(
      MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );
  }
}

function mockPatchListingsItem(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedPatchListing.mockRejectedValue(error);
  } else {
    mockedPatchListing.mockResolvedValue(
      MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );
  }
}

function buildPostNextRequest() {
  return new NextRequest("http://localhost:3000/api/listingsitem", {
    method: "POST",
    headers: {
      sku: SKU,
      locale: US_LOCALE,
      productType: PRODUCT_TYPE,
      useCase: USE_CASE,
    },
    body: serializeToJsonString({
      initialListing: {
        externally_assigned_product_identifier: [
          {
            type: "upc",
            value: "650450120249",
            marketplace_id: "ATVPDKIKX0DER",
          },
        ],
      },
      currentListing: {
        externally_assigned_product_identifier: [
          {
            type: "upc",
            value: "650450120250",
            marketplace_id: "ATVPDKIKX0DER",
          },
        ],
      },
    }),
  });
}

function buildDeleteNextRequest() {
  return new NextRequest("http://localhost:3000/api/listingsitem", {
    method: "DELETE",
    headers: {
      sku: SKU,
      locale: US_LOCALE,
    },
  });
}

describe("Test PUT ListingsItem SP-API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful call to Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem();
    mockResolveFetchResponse(
      200,
      MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 200, true);
  });

  test("returns 500 on exception from settings response when calling Put Listings Item API", async () => {
    mockSettings(500);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem();
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, false);
  });

  test("returns 400 exception from missing SKU header from Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(undefined, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 400, false);
  });

  test("returns 400 exception from missing locale header from Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, undefined, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 400, false);
  });

  test("returns 400 exception from missing Product Type header from Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, undefined, USE_CASE);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 400, false);
  });

  test("returns 400 exception from missing Use case header from Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, undefined);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 400, false);
  });

  test("returns 400 exception from missing current Listing data in request body", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);
    const nextRequest = new NextRequest(
      "http://localhost:3000/api/submitListing",
      {
        method: "POST",
        headers: {
          sku: SKU,
          locale: US_LOCALE,
          productType: PRODUCT_TYPE,
          useCase: USE_CASE,
        },
        body: serializeToJsonString({
          initialListing: {},
        }),
      },
    );

    await verifyStatusAndBody(await POST(nextRequest), 400, false);
  });

  test("returns 400 exception from missing initial Listing data in request body", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);
    const nextRequest = new NextRequest(
      "http://localhost:3000/api/listingsitem",
      {
        method: "POST",
        headers: {
          sku: SKU,
          locale: US_LOCALE,
          productType: PRODUCT_TYPE,
          useCase: USE_CASE,
        },
        body: serializeToJsonString({
          currentListing: {},
        }),
      },
    );

    await verifyStatusAndBody(await POST(nextRequest), 400, false);
  });

  test("returns 500 exception from invoking Put Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, USE_CASE);
    mockPutListingsItem({
      status: 500,
    });
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, false);
  });
});

describe("Test GET ListingsItem SP-API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful call to Get Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockGetListingsItem();
    mockResolveFetchResponse(200, MOCK_GET_LISTINGS_ITEM_API_SUCCESS_RESPONSE);

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on successful call to Get Listings Item API with no summary data", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
    mockedGetListing.mockResolvedValue(
      MOCK_GET_LISTINGS_ITEM_API_EMPTY_SUMMARY_RESPONSE,
    );
    mockResolveFetchResponse(
      200,
      MOCK_GET_LISTINGS_ITEM_API_EMPTY_SUMMARY_RESPONSE,
    );

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 200 on 404 response from Get Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockGetListingsItem({ status: 404 });
    mockResolveFetchResponse(200, {});

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on exception from settings response when calling Get Listings Item API", async () => {
    mockSettings(500);
    mockHeaders(SKU, US_LOCALE);
    mockGetListingsItem();
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 400 exception from missing SKU header from Get Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(undefined, US_LOCALE);
    mockGetListingsItem({ status: 400 });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 400 on call to Get Listings Item API on missing locale", async () => {
    mockSettings(200);
    mockHeaders(SKU, undefined);
    mockGetListingsItem();
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 500 exception from invoking Get Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockGetListingsItem({ status: 500 });
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await GET(), 500, false);
  });
});

describe("Test DELETE ListingsItem API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful call to DELETE Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockDeleteListingsItem();
    mockResolveFetchResponse(
      200,
      MOCK_DELETE_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );

    await verifyStatusAndBody(
      await DELETE(buildDeleteNextRequest()),
      200,
      true,
    );
  });

  test("returns 500 on exception from settings response when calling DELETE Listings Item API", async () => {
    mockSettings(500);
    mockHeaders(SKU, US_LOCALE);
    mockDeleteListingsItem();
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(
      await DELETE(buildDeleteNextRequest()),
      500,
      false,
    );
  });

  test("returns 400 exception from missing SKU header from Delete Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(undefined, US_LOCALE);
    mockDeleteListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(
      await DELETE(buildDeleteNextRequest()),
      400,
      false,
    );
  });

  test("returns 400 exception from missing locale header from Delete Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, undefined);
    mockDeleteListingsItem({
      status: 400,
    });
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(
      await DELETE(buildDeleteNextRequest()),
      400,
      false,
    );
  });

  test("returns 500 exception from invoking Delete Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE);
    mockDeleteListingsItem({
      status: 500,
    });
    mockRejectFetchResponse(500);
    await verifyStatusAndBody(
      await DELETE(buildDeleteNextRequest()),
      500,
      true,
    );
  });
});

describe("Test PATCH ListingsItem API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("returns 200 on successful call to Patch Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, "UpdateListing");
    mockPatchListingsItem();
    mockResolveFetchResponse(
      200,
      MOCK_PUT_AND_PATCH_LISTINGS_ITEM_API_SUCCESS_RESPONSE,
    );

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 200, true);
  });

  test("returns 500 exception from invoking Patch Listings Item API", async () => {
    mockSettings(200);
    mockHeaders(SKU, US_LOCALE, PRODUCT_TYPE, "UpdateListing");
    mockPatchListingsItem({
      status: 500,
    });
    mockRejectFetchResponse(500);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, true);
  });
});
