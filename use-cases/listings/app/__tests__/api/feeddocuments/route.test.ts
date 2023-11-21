import getSPAPIEndpoint, {
  buildFeedsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { getSettings } from "@/app/api/settings/wrapper";
import { headers } from "next/dist/client/components/headers";
import fetch from "jest-fetch-mock";
import { ReadonlyHeaders } from "next/dist/server/web/spec-extension/adapters/headers";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { mock, instance, when, reset } from "ts-mockito";
import {
  CONTENT_TYPE_HEADER,
  FEED_DOCUMENT_ID_HEADER,
  JSON_FILE_TYPE,
} from "@/app/constants/global";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";
import { FeedsApi } from "@/app/sdk/feeds_2021-06-30";
import { GET } from "@/app/api/feeddocuments/route";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponseNoJsonSerialization,
} from "@/app/test-utils/mock-fetch";
import { gzipSync } from "zlib";

const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";

const MOCK_FEED_DOCUMENT_ID =
  "amzn1.tortuga.3.ed4cd0d8-447b-4c22-96b5-52da8ace1207.T3YUVYPGKE9BMY";
const MOCK_FEED_DOCUMENT = {
  feedDocumentId: MOCK_FEED_DOCUMENT_ID,
  url: "https://tortuga-prod-na.s3.amazonaws.com",
  compressionAlgorithm: "GZIP",
};
const MOCK_UNCOMPRESSED_FEED_DOCUMENT = {
  feedDocumentId: MOCK_FEED_DOCUMENT_ID,
  url: "https://tortuga-prod-na.s3.amazonaws.com",
};
const HEADERS_FOR_MOCK_FETCH_RESPONSE = {
  [CONTENT_TYPE_HEADER]: [JSON_FILE_TYPE],
};

// @ts-ignore
const mockReadOnlyHeaders: ReadonlyHeaders = mock(ReadonlyHeaders);

const mockedGetFeedDocument = jest.fn();
const feedsApi: FeedsApi = new FeedsApi(undefined);
feedsApi.getFeedDocument = mockedGetFeedDocument;

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildFeedsAPIClient = jest.mocked(buildFeedsAPIClient);
mockedBuildFeedsAPIClient.mockResolvedValue(feedsApi);
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

function mockHeaders(feedDocumentId?: string) {
  feedDocumentId &&
    when(mockReadOnlyHeaders.get(FEED_DOCUMENT_ID_HEADER)).thenReturn(
      feedDocumentId,
    );
  mockedHeaders.mockReturnValue(instance(mockReadOnlyHeaders));
}

function mockGetFeedDocument(mockFeedDocument: any, error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedGetFeedDocument.mockRejectedValue(error);
  } else {
    mockedGetFeedDocument.mockResolvedValue(mockFeedDocument);
  }
}
describe("Test for the GET feeddocuments API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  afterEach(() => {
    reset(mockReadOnlyHeaders);
  });

  test("Returns 200 on successful retrieval of compressed feed document", async () => {
    mockSettings(200);
    mockHeaders(MOCK_FEED_DOCUMENT_ID);
    mockGetFeedDocument(MOCK_FEED_DOCUMENT);
    mockResolveFetchResponseNoJsonSerialization(
      200,
      gzipSync(Buffer.from("Report")),
      HEADERS_FOR_MOCK_FETCH_RESPONSE,
    );

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("Returns 200 on successful retrieval of uncompressed feed document", async () => {
    mockSettings(200);
    mockHeaders(MOCK_FEED_DOCUMENT_ID);
    mockGetFeedDocument(MOCK_UNCOMPRESSED_FEED_DOCUMENT);
    mockResolveFetchResponseNoJsonSerialization(
      200,
      "Report",
      HEADERS_FOR_MOCK_FETCH_RESPONSE,
    );

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("Returns 500 on feed document content fetch failure", async () => {
    mockSettings(200);
    mockHeaders(MOCK_FEED_DOCUMENT_ID);
    mockGetFeedDocument(MOCK_UNCOMPRESSED_FEED_DOCUMENT);
    mockRejectFetchResponse(400);

    await verifyStatusAndBody(await GET(), 500, true);
  });

  test("returns 500 on settings fetch failure", async () => {
    mockSettings(500);
    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 400 on missing feedDocumentId in headers", async () => {
    mockSettings(200);
    mockHeaders(undefined);
    await verifyStatusAndBody(await GET(), 400, false);
  });

  test("returns 404 on failure making call to the GetFeedDocument API", async () => {
    mockSettings(200);
    mockHeaders(MOCK_FEED_DOCUMENT_ID);
    mockGetFeedDocument(undefined, {
      status: 404,
    });
    await verifyStatusAndBody(await GET(), 404, true);
  });
});
