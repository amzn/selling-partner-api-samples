import nextResponse from "@/app/utils/next-response-factory";
import { Settings } from "@/app/[locale]/settings/settings";
import { headers } from "next/dist/client/components/headers";
import {
  CURRENT_LISTING_BODY,
  DELETE_LISTINGS_ITEM_API_DOC_LINK,
  DELETE_LISTINGS_ITEM_API_NAME,
  GET_LISTINGS_ITEM_API_DOC_LINK,
  GET_LISTINGS_ITEM_API_NAME,
  INITIAL_LISTING_BODY,
  LOCALE_HEADER,
  MODE,
  PATCH_LISTINGS_ITEM_API_DOC_LINK,
  PATCH_LISTINGS_ITEM_API_NAME,
  PRODUCT_TYPE_HEADER,
  PUT_LISTINGS_ITEM_API_DOC_LINK,
  PUT_LISTINGS_ITEM_API_NAME,
  SKU_HEADER,
  STATUS,
  WRITE_OPERATION_HEADER,
  USE_CASE_HEADER,
  USE_CASE_TO_REQUIREMENTS,
} from "@/app/constants/global";
import { NextRequest, NextResponse } from "next/server";
import getSPAPIEndpoint, {
  buildListingsItemsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  Item,
  ListingsItemPatchRequest,
  ListingsItemPutRequest,
  PatchOperation,
} from "@/app/sdk/listingsItems_2021-08-01";
import { computePatches } from "@/app/utils/json-feed";
import {
  handleSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
  retrieveSettingsAndInvokeAPILogicWithRequest,
} from "@/app/utils/api";
import { Listing } from "@/app/model/types";
import { isFullUpdate } from "@/app/utils/listings-item";

/**
 * This export forces the NextJs not to pre-render this api route.
 */
export const dynamic = "force-dynamic";

/**
 * Retrieve Listing details from Amazon Catalog by invoking the GetListingsItem SP-API.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getListingsItemHandler);
}

async function getListingsItemHandler(settings: Settings) {
  const validateHeadersResponse =
    retrieveAndValidateRequestParamsFromHeaderForGetRequest();

  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { sku, locale } = validateHeadersResponse;
  const nextResponseOrSPAPIRequestResponse = await fetchGetListingsItem(
    settings,
    sku,
    locale,
  );

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: constructGetListingsResponse(
        nextResponseOrSPAPIRequestResponse.response,
        locale,
      ),
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

/**
 * Submit/Update Listing to Amazon Catalog by invoking the PutListingsItem/PatchListingsItem SP-API.
 * @constructor
 */
export async function POST(request: NextRequest) {
  return retrieveSettingsAndInvokeAPILogicWithRequest(
    submitListingsItemHandler,
    request,
  );
}

async function submitListingsItemHandler(
  settings: Settings,
  request: NextRequest,
) {
  const requiredParametersResponse =
    await validateAndRetrieveRequiredParametersForPostRequests(request);

  if (requiredParametersResponse instanceof NextResponse) {
    return requiredParametersResponse;
  }

  const {
    currentListing,
    initialListing,
    sku,
    productType,
    locale,
    useCase,
    writeOperation,
    mode,
  } = requiredParametersResponse;

  let nextResponseOrSPAPIRequestResponse;

  // We want to invoke PutListingsItem for All Create-Offer, Create-Listing use cases as well as
  // PutListingsItem write operation.
  if (isFullUpdate(useCase, writeOperation ?? undefined)) {
    nextResponseOrSPAPIRequestResponse = await invokePutListingsItem(
      productType,
      useCase,
      currentListing,
      settings,
      sku,
      locale,
      mode,
    );
  } else {
    nextResponseOrSPAPIRequestResponse = await invokePatchListingsItem(
      productType,
      initialListing,
      currentListing,
      settings,
      sku,
      locale,
      mode,
    );
  }

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: nextResponseOrSPAPIRequestResponse.response,
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

async function invokePutListingsItem(
  productType: string,
  useCase: string,
  currentListing: any,
  settings: Settings,
  sku: string,
  locale: string,
  mode: string | null,
) {
  const listingsItemPutRequest = constructListingsItemPutRequest(
    productType,
    useCase,
    currentListing,
  );

  // Create New Listing using the Listing Item Put API.
  return await fetchPutListingsItem(
    settings,
    sku,
    listingsItemPutRequest,
    locale,
    mode,
  );
}

async function invokePatchListingsItem(
  productType: string,
  initialListing: any,
  currentListing: any,
  settings: Settings,
  sku: string,
  locale: string,
  mode: string | null,
) {
  const listingsItemPatchRequest = constructListingsItemPatchRequest(
    productType,
    currentListing,
    initialListing,
  );
  // Update Listing using the Listing Item Patch API.
  return await fetchPatchListingsItem(
    settings,
    sku,
    listingsItemPatchRequest,
    locale,
    mode,
  );
}

async function validateAndRetrieveRequiredParametersForPostRequests(
  request: NextRequest,
) {
  // Validate and retrieve Request body.
  const validateRequestBodyResponse = validateAndRetrieveRequestBody(
    await request.json(),
  );

  if (validateRequestBodyResponse instanceof NextResponse) {
    return validateRequestBodyResponse;
  }

  const { currentListing, initialListing } = validateRequestBodyResponse;

  // Validate and retrieve Request Headers.
  const validateHeadersResponse =
    validateAndRetrieveRequestParamsFromHeaderForPostRequest();

  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { sku, productType, locale, useCase, writeOperation, mode } =
    validateHeadersResponse;

  return {
    currentListing,
    initialListing,
    sku,
    productType,
    locale,
    useCase,
    writeOperation,
    mode,
  };
}

/**
 * Delete Listing from Amazon Catalog by invoking the DeleteListingsItem SP-API.
 * @constructor
 */
export async function DELETE(request: NextRequest) {
  return retrieveSettingsAndInvokeAPILogicWithRequest(
    deleteListingsItemHandler,
    request,
  );
}

async function deleteListingsItemHandler(
  settings: Settings,
  request: NextRequest,
) {
  // Validate and retrieve Request Headers.
  const validateHeadersResponse =
    validateAndRetrieveRequestParamsFromHeaderForDeleteRequest();

  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { sku, locale } = validateHeadersResponse;

  const nextResponseOrSPAPIRequestResponse = await fetchDeleteListingsItem(
    settings,
    sku,
    locale,
  );

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: nextResponseOrSPAPIRequestResponse.response,
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

function constructGetListingsResponse(originalResponse: any, locale: string) {
  const itemData: Item = Item.constructFromObject(originalResponse, {});
  const summary = itemData.summaries && itemData.summaries[0];
  return {
    attributes: itemData.attributes,
    issues: itemData.issues,
    ...(summary && {
      productType: summary.productType,
    }),
  } as Listing;
}

function retrieveAndValidateRequestParamsFromHeaderForGetRequest() {
  const requestHeaders = headers();
  const sku = requestHeaders.get(SKU_HEADER);
  const locale = requestHeaders.get(LOCALE_HEADER);

  if (!sku) {
    const errorMessage = "The request is missing the sku data in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  if (!locale) {
    const errorMessage =
      "The request is missing the locale data in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  return { sku, locale };
}

function validateAndRetrieveRequestBody(requestBody: any) {
  const currentListing = requestBody[CURRENT_LISTING_BODY];
  if (!currentListing) {
    const errorMessage =
      "The request is missing the current listing data in the body";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  const initialListing = requestBody[INITIAL_LISTING_BODY];
  if (!initialListing) {
    const errorMessage =
      "The request is missing the initial listing data in the body";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  return { currentListing, initialListing };
}

function validateAndRetrieveRequestParamsFromHeaderForPostRequest() {
  const requestHeaders = headers();
  const sku = requestHeaders.get(SKU_HEADER);
  const locale = requestHeaders.get(LOCALE_HEADER);
  const productType = requestHeaders.get(PRODUCT_TYPE_HEADER);
  const useCase = requestHeaders.get(USE_CASE_HEADER);
  const writeOperation = requestHeaders.get(WRITE_OPERATION_HEADER);
  const mode = requestHeaders.get(MODE);

  if (!sku) {
    const errorMessage = "The request is missing the sku in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  if (!locale) {
    const errorMessage = "The request is missing the locale in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  if (!productType) {
    const errorMessage =
      "The request is missing the productType in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  if (!useCase) {
    const errorMessage = "The request is missing the useCase in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  return { sku, productType, locale, useCase, writeOperation, mode };
}

function validateAndRetrieveRequestParamsFromHeaderForDeleteRequest() {
  const requestHeaders = headers();
  const sku = requestHeaders.get(SKU_HEADER);
  const locale = requestHeaders.get(LOCALE_HEADER);

  if (!sku) {
    const errorMessage = "The request is missing the sku in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  if (!locale) {
    const errorMessage = "The request is missing the locale in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  return { sku, locale };
}

function constructListingsItemPutRequest(
  productType: string,
  useCase: string,
  listing: object,
) {
  const listingsItemPutRequestData = {
    productType: productType,
    requirements: USE_CASE_TO_REQUIREMENTS[useCase],
    attributes: listing,
  };

  return ListingsItemPutRequest.constructFromObject(
    listingsItemPutRequestData,
    undefined,
  );
}

function constructListingsItemPatchRequest(
  productType: string,
  currentListing: object,
  initialListing: object,
) {
  const patchOperationObject = computePatches(
    currentListing,
    initialListing,
  ).map((data) => PatchOperation.constructFromObject(data, undefined));
  const listingPatchRequestObject = {
    productType: productType,
    patches: patchOperationObject,
  };

  return ListingsItemPatchRequest.constructFromObject(
    listingPatchRequestObject,
    undefined,
  );
}

async function fetchGetListingsItem(
  settings: Settings,
  sku: string,
  locale: string,
) {
  const listingsApi = await buildListingsItemsAPIClient(
    getSPAPIEndpoint(settings.region),
  );
  const includedData = ["attributes", "summaries", "issues"];
  const reqResponse = {
    apiName: GET_LISTINGS_ITEM_API_NAME,
    apiDocumentationLink: GET_LISTINGS_ITEM_API_DOC_LINK,
    request: {
      sellerId: settings.sellingPartnerId,
      sku: sku,
      marketplaceIds: [settings.marketplaceId],
      issueLocale: locale,
      includedData: includedData,
    },
    response: {},
  };
  const optParameters = {
    includedData: reqResponse.request.includedData,
    issueLocale: reqResponse.request.issueLocale,
  };

  try {
    reqResponse.response = await listingsApi.getListingsItem(
      reqResponse.request.sellerId,
      reqResponse.request.sku,
      reqResponse.request.marketplaceIds,
      optParameters,
    );

    return reqResponse;
  } catch (error: any) {
    reqResponse.response = error;
    // The error is generally the Error object from the superagent.
    const errorMessage = "Error while making call to the GetListingsItem API.";
    console.log(errorMessage + " " + error);

    // Proxy the status from the SP API.
    let status = 500;
    if (error instanceof Object && error.hasOwnProperty(STATUS)) {
      // No need to report the call as error if SKU is not found.
      if (error.status === 404) {
        return nextResponse(
          200,
          "OK",
          serializeToJsonString({
            data: {},
            debugContext: [reqResponse],
          }),
        );
      }
      status = error.status;
    }

    return nextResponse(
      status,
      errorMessage,
      serializeToJsonString({
        debugContext: [reqResponse],
      }),
    );
  }
}

async function fetchPutListingsItem(
  settings: Settings,
  sku: string,
  body: ListingsItemPutRequest,
  locale: string,
  mode: string | null,
) {
  const listingsItemApi = await buildListingsItemsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: PUT_LISTINGS_ITEM_API_NAME,
    apiDocumentationLink: PUT_LISTINGS_ITEM_API_DOC_LINK,
    request: {
      sellerId: settings.sellingPartnerId,
      sku: sku,
      marketplaceIds: [settings.marketplaceId],
      issueLocale: locale,
      body: body,
      mode: mode,
    },
    response: {},
  };

  try {
    reqResponse.response = await listingsItemApi.putListingsItem(
      reqResponse.request.sellerId,
      reqResponse.request.sku,
      reqResponse.request.marketplaceIds,
      reqResponse.request.body,
      {
        issueLocale: reqResponse.request.issueLocale,
        mode: reqResponse.request.mode,
      },
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}

async function fetchPatchListingsItem(
  settings: Settings,
  sku: string,
  body: ListingsItemPatchRequest,
  locale: string,
  mode: string | null,
) {
  const listingsItemApi = await buildListingsItemsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: PATCH_LISTINGS_ITEM_API_NAME,
    apiDocumentationLink: PATCH_LISTINGS_ITEM_API_DOC_LINK,
    request: {
      sellerId: settings.sellingPartnerId,
      sku: sku,
      marketplaceIds: [settings.marketplaceId],
      issueLocale: locale,
      body: body,
      mode: mode,
    },
    response: {},
  };

  try {
    reqResponse.response = await listingsItemApi.patchListingsItem(
      reqResponse.request.sellerId,
      reqResponse.request.sku,
      reqResponse.request.marketplaceIds,
      reqResponse.request.body,
      {
        issueLocale: reqResponse.request.issueLocale,
        mode: reqResponse.request.mode,
      },
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}

async function fetchDeleteListingsItem(
  settings: Settings,
  sku: string,
  locale: string,
) {
  const listingsApi = await buildListingsItemsAPIClient(
    getSPAPIEndpoint(settings.region),
  );
  const reqResponse = {
    apiName: DELETE_LISTINGS_ITEM_API_NAME,
    apiDocumentationLink: DELETE_LISTINGS_ITEM_API_DOC_LINK,
    request: {
      sellerId: settings.sellingPartnerId,
      sku: sku,
      marketplaceIds: [settings.marketplaceId],
      issueLocale: locale,
    },
    response: {},
  };
  const optParameters = {
    issueLocale: reqResponse.request.issueLocale,
  };

  try {
    reqResponse.response = await listingsApi.deleteListingsItem(
      reqResponse.request.sellerId,
      reqResponse.request.sku,
      reqResponse.request.marketplaceIds,
      optParameters,
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}
