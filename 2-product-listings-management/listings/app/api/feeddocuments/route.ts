import nextResponse from "@/app/utils/next-response-factory";
import { serializeToJsonString } from "@/app/utils/serialization";
import { NextResponse } from "next/server";
import { Settings } from "@/app/[locale]/settings/settings";
import { headers } from "next/dist/client/components/headers";
import {
  CONTENT_TYPE_HEADER,
  FEED_DOCUMENT_ID_HEADER,
  GET_FEED_DOCUMENT_API_NAME,
  GET_FEED_DOCUMENT_DOC_LINK,
  NO_CACHING_DIRECTIVE,
} from "@/app/constants/global";
import getSPAPIEndpoint, {
  buildFeedsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { FeedDocument } from "@/app/sdk/feeds_2021-06-30";
import {
  handleSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
} from "@/app/utils/api";
import { unzipSync } from "zlib";
import { SPAPIRequestResponse } from "@/app/model/types";

/**
 * This export forces the NextJs not to pre-render this api route.
 */
export const dynamic = "force-dynamic";

/**
 * Retrieves a feed document content and returns the content in the API response.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getFeedDocumentContentHandler);
}

async function getFeedDocumentContentHandler(settings: Settings) {
  const requiredParametersResponse =
    await validateAndRetrieveRequiredParametersForGetRequest();

  if (requiredParametersResponse instanceof NextResponse) {
    return requiredParametersResponse;
  }

  const { feedDocumentId } = requiredParametersResponse;

  const nextResponseOrSPAPIRequestResponse = await getFeedDocumentUrl(
    settings,
    feedDocumentId,
  );

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  const getFeedDocumentContentResponse = await getFeedDocumentContent(
    FeedDocument.constructFromObject(
      nextResponseOrSPAPIRequestResponse.response,
      undefined,
    ),
    nextResponseOrSPAPIRequestResponse,
  );

  if (getFeedDocumentContentResponse instanceof NextResponse) {
    return getFeedDocumentContentResponse;
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: {
        content: getFeedDocumentContentResponse.feedDocumentContent,
        contentType: getFeedDocumentContentResponse.feedDocumentContentType,
      },
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

async function validateAndRetrieveRequiredParametersForGetRequest() {
  const validateHeadersResponse =
    validateAndRetrieveRequestParamsFromHeaderForGetRequest();
  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { feedDocumentId } = validateHeadersResponse;
  return { feedDocumentId };
}

function validateAndRetrieveRequestParamsFromHeaderForGetRequest() {
  const requestHeaders = headers();
  const feedDocumentId = requestHeaders.get(FEED_DOCUMENT_ID_HEADER);
  if (!feedDocumentId) {
    const errorMessage =
      "The request is missing the feedDocumentId in the headers";
    return nextResponse(400, errorMessage);
  }

  return { feedDocumentId };
}

async function getFeedDocumentUrl(settings: Settings, feedDocumentId: string) {
  const feedsApi = await buildFeedsAPIClient(getSPAPIEndpoint(settings.region));
  const reqResponse = {
    apiName: GET_FEED_DOCUMENT_API_NAME,
    apiDocumentationLink: GET_FEED_DOCUMENT_DOC_LINK,
    request: {
      feedDocumentId: [feedDocumentId],
    },
    response: {},
  };

  try {
    reqResponse.response = await feedsApi.getFeedDocument(feedDocumentId);
    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}

async function getFeedDocumentContent(
  feedDocument: FeedDocument,
  requestResponse: SPAPIRequestResponse,
) {
  try {
    const fetchDocumentResponse = await fetch(feedDocument.url, {
      cache: NO_CACHING_DIRECTIVE,
    });
    const feedDocumentContentType =
      fetchDocumentResponse.headers.get(CONTENT_TYPE_HEADER);
    let feedDocumentContent = "";
    if (feedDocument.compressionAlgorithm) {
      feedDocumentContent = unzipSync(
        await fetchDocumentResponse.arrayBuffer(),
      ).toString();
    } else {
      feedDocumentContent = await fetchDocumentResponse.text();
    }
    return { feedDocumentContent, feedDocumentContentType };
  } catch (error) {
    // Generally these errors are recoverable.
    const errorMessage = "Error while fetching the feed document content.";
    console.log(errorMessage + " " + error);
    return nextResponse(
      500,
      errorMessage,
      serializeToJsonString({
        debugContext: [requestResponse],
      }),
    );
  }
}
