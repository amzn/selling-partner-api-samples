import nextResponse from "@/app/utils/next-response-factory";
import { NextRequest, NextResponse } from "next/server";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  CREATE_FEED_API_DOC_LINK,
  CREATE_FEED_API_NAME,
  CREATE_FEED_DOCUMENT_API_DOC_LINK,
  CREATE_FEED_DOCUMENT_API_NAME,
  GET_FEEDS_API_NAME,
  GET_FEEDS_DOC_LINK,
  JSON_FILE_TYPE,
  JSON_LISTINGS_FEED_TYPE,
  NO_CACHING_DIRECTIVE,
} from "@/app/constants/global";
import { Settings } from "@/app/[locale]/settings/settings";
import getSPAPIEndpoint, {
  buildFeedsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  CreateFeedDocumentResponse,
  CreateFeedDocumentSpecification,
  CreateFeedSpecification,
  GetFeedsResponse,
} from "@/app/sdk/feeds_2021-06-30";
import {
  handleChainedSPAPIInvocationError,
  handleSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
  retrieveSettingsAndInvokeAPILogicWithRequest,
} from "@/app/utils/api";

/**
 * This export forces the NextJs not to pre-render this api route.
 */
export const dynamic = "force-dynamic";

/**
 * Creates a feed and return feed details in the API Response.
 * @param request the next request.
 * @constructor
 */
export async function POST(request: NextRequest) {
  return retrieveSettingsAndInvokeAPILogicWithRequest(
    createFeedHandler,
    request,
  );
}

async function createFeedHandler(settings: Settings, request: NextRequest) {
  const formData = await request.blob();

  const debugContext: any[] = [];

  const selectedFileContent = await formData.text();
  // Create and upload Document
  const nextOrSPAPIRequestResponseForDocumentCreate =
    await fetchCreateFeedDocument(settings, debugContext, selectedFileContent);

  if (nextOrSPAPIRequestResponseForDocumentCreate instanceof NextResponse) {
    return nextOrSPAPIRequestResponseForDocumentCreate;
  }

  const feedDocumentResponse =
    nextOrSPAPIRequestResponseForDocumentCreate.response as CreateFeedDocumentResponse;

  // Create Feed
  const nextOrSPAPIResponseForCreateFeed = await fetchCreateFeed(
    settings,
    feedDocumentResponse,
    debugContext,
  );
  if (nextOrSPAPIResponseForCreateFeed instanceof NextResponse) {
    return nextOrSPAPIResponseForCreateFeed;
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: nextOrSPAPIResponseForCreateFeed.response,
      debugContext: debugContext,
    }),
  );
}

/**
 * API which returns the past submitted feeds to the UI. Only the first page of
 * results are sent back.
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getPastFeedsHandler);
}

async function getPastFeedsHandler(settings: Settings) {
  const nextResponseOrSPAPIRequestResponse = await fetchFeeds(settings);

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  const getFeedsResponse = GetFeedsResponse.constructFromObject(
    nextResponseOrSPAPIRequestResponse.response,
    undefined,
  );
  const feeds: any[] = getFeedsResponse?.feeds?.length
    ? getFeedsResponse.feeds
    : [];

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: feeds,
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

async function fetchCreateFeedDocument(
  settings: Settings,
  debugContext: any[],
  feedContent: string,
) {
  const feedsApi = await buildFeedsAPIClient(getSPAPIEndpoint(settings.region));
  const jsonFeedDocSpec: CreateFeedDocumentSpecification =
    new CreateFeedDocumentSpecification(JSON_FILE_TYPE);
  const reqResponse = {
    apiName: CREATE_FEED_DOCUMENT_API_NAME,
    apiDocumentationLink: CREATE_FEED_DOCUMENT_API_DOC_LINK,
    request: jsonFeedDocSpec,
    response: {},
  };

  try {
    // Create Document
    const response: CreateFeedDocumentResponse =
      await feedsApi.createFeedDocument(jsonFeedDocSpec);

    // Upload Document
    await fetch(response.url, {
      cache: NO_CACHING_DIRECTIVE,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: feedContent,
    });
    reqResponse.response = response;
    debugContext.push(reqResponse);
    return reqResponse;
  } catch (error: any) {
    return handleChainedSPAPIInvocationError(error, debugContext, reqResponse);
  }
}

async function fetchCreateFeed(
  settings: Settings,
  createFeedDocumentResponse: CreateFeedDocumentResponse,
  debugContext: any[],
) {
  const feedsApi = await buildFeedsAPIClient(getSPAPIEndpoint(settings.region));
  const feedRequest: CreateFeedSpecification = new CreateFeedSpecification(
    JSON_LISTINGS_FEED_TYPE,
    [settings.marketplaceId],
    createFeedDocumentResponse.feedDocumentId,
  );
  const reqResponse = {
    apiName: CREATE_FEED_API_NAME,
    apiDocumentationLink: CREATE_FEED_API_DOC_LINK,
    request: feedRequest,
    response: {},
  };

  try {
    reqResponse.response = await feedsApi.createFeed(feedRequest);
    debugContext.push(reqResponse);
    return reqResponse;
  } catch (error: any) {
    return handleChainedSPAPIInvocationError(error, debugContext, reqResponse);
  }
}

async function fetchFeeds(settings: Settings) {
  const feedsApi = await buildFeedsAPIClient(getSPAPIEndpoint(settings.region));
  const reqResponse = {
    apiName: GET_FEEDS_API_NAME,
    apiDocumentationLink: GET_FEEDS_DOC_LINK,
    request: {
      feedTypes: [JSON_LISTINGS_FEED_TYPE],
      marketplaceIds: [settings.marketplaceId],
      pageSize: 20,
    },
    response: {},
  };

  try {
    reqResponse.response = await feedsApi.getFeeds(reqResponse.request);
    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}
