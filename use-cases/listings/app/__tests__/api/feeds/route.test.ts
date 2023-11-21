import getSPAPIEndpoint, {
  buildFeedsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { getSettings } from "@/app/api/settings/wrapper";
import fetch from "jest-fetch-mock";
import { MOCK_SETTINGS } from "@/app/test-utils/mock-settings";
import { verifyStatusAndBody } from "@/app/test-utils/next-response-helper";
import { FeedsApi } from "@/app/sdk/feeds_2021-06-30";
import { GET, POST } from "@/app/api/feeds/route";
import {
  MOCK_FEED_1,
  MOCK_FEED_2,
  MOCK_CREATE_FEED_DOCUMENT_SUCCESS,
  MOCK_CREATE_FEED_SUCCESS,
} from "@/app/test-utils/mock-feed";
import { JSON_FILE_TYPE } from "@/app/constants/global";
import { NextRequest } from "next/server";
import {
  mockRejectFetchResponse,
  mockResolveFetchResponse,
} from "@/app/test-utils/mock-fetch";

const MOCK_SPI_API_URL: string = "https://sellingpartnerapi-na.amazon.com";

const MOCK_GET_FEEDS_RESPONSE = {
  feeds: [MOCK_FEED_1, MOCK_FEED_2],
};

const feedsApi: FeedsApi = new FeedsApi(undefined);
const mockedGetFeeds = jest.fn();
const mockedCreateFeedDocument = jest.fn();
const mockedCreateFeed = jest.fn();

feedsApi.getFeeds = mockedGetFeeds;
feedsApi.createFeedDocument = mockedCreateFeedDocument;
feedsApi.createFeed = mockedCreateFeed;

function buildPostNextRequest() {
  const feedContentBlob = new Blob(["{   }"], {
    type: JSON_FILE_TYPE,
  });
  return new NextRequest("http://localhost:3000/api/feeds", {
    method: "POST",
    body: feedContentBlob,
  });
}

function mockCreateFeedDocument(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedCreateFeedDocument.mockRejectedValue(error);
  } else {
    mockedCreateFeedDocument.mockResolvedValue(
      MOCK_CREATE_FEED_DOCUMENT_SUCCESS,
    );
  }
}

function mockCreateFeed(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedCreateFeed.mockRejectedValue(error);
  } else {
    mockedCreateFeed.mockResolvedValue(MOCK_CREATE_FEED_SUCCESS);
  }
}

function mockFetch(status?: number) {
  if (status) {
    mockRejectFetchResponse(status);
  } else {
    mockResolveFetchResponse(200, {});
  }
}

jest.mock("@/app/sdk/factory/ListingsSPAPIClientsFactory");
const mockedBuildFeedsAPIClient = jest.mocked(buildFeedsAPIClient);
mockedBuildFeedsAPIClient.mockResolvedValue(feedsApi);
const mockedGetSPAPIEndpoint = jest.mocked(getSPAPIEndpoint);

jest.mock("@/app/api/settings/wrapper");
const mockedGetSettings = jest.mocked(getSettings);

function mockSettings(status: number) {
  mockedGetSettings.mockResolvedValue({
    status: status,
    statusText: "Some Status Text",
    settings: MOCK_SETTINGS,
  });
}

function mockGetFeeds(error?: object) {
  mockedGetSPAPIEndpoint.mockReturnValue(MOCK_SPI_API_URL);
  if (error) {
    mockedGetFeeds.mockRejectedValue(error);
  } else {
    mockedGetFeeds.mockResolvedValue(MOCK_GET_FEEDS_RESPONSE);
  }
}

describe("Test for the GET feeds API", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  test("Returns 200 on successful retrieval of feeds", async () => {
    mockSettings(200);
    mockGetFeeds();

    await verifyStatusAndBody(await GET(), 200, true);
  });

  test("returns 500 on settings fetch failure", async () => {
    mockSettings(500);
    await verifyStatusAndBody(await GET(), 500, false);
  });

  test("returns 404 on failure making call to the GetFeeds API", async () => {
    mockSettings(200);
    mockGetFeeds({
      status: 404,
    });
    await verifyStatusAndBody(await GET(), 404, true);
  });
});

describe("Test Create Feed", () => {
  beforeEach(() => {
    fetch.resetMocks();
    jest.clearAllMocks();
  });

  test("Returns 200 on Success full feed creations", async () => {
    mockSettings(200);
    mockCreateFeedDocument();
    mockFetch();
    mockCreateFeed();

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 200, true);
  });

  test("returns 500 on exception from settings response when calling POST Feed", async () => {
    mockSettings(500);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, false);
  });

  test("returns 500 on exception while uploading feed document", async () => {
    mockSettings(200);
    mockCreateFeedDocument();
    mockFetch(500);

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, true);
  });

  test("returns 500 on exception while creating feed", async () => {
    mockSettings(200);
    mockCreateFeedDocument();
    mockFetch();
    mockCreateFeed({
      error: 429,
      statusText: "Quota Exceeded",
    });

    await verifyStatusAndBody(await POST(buildPostNextRequest()), 500, true);
  });
});
