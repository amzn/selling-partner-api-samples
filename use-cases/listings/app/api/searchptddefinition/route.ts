import { NextResponse } from "next/server";
import { Settings } from "@/app/[locale]/settings/settings";
import getSPAPIEndpoint, {
  buildDefinitionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  ProductTypeList,
  ProductType,
} from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { headers } from "next/dist/client/components/headers";
import {
  SEARCH_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK,
  SEARCH_DEFINITIONS_PRODUCT_TYPE_API_NAME,
  KEYWORDS_HEADER,
} from "@/app/constants/global";
import nextResponse from "@/app/utils/next-response-factory";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  handleSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
} from "@/app/utils/api";

/**
 * This export forces the NextJs not to pre-render this api route.
 */
export const dynamic = "force-dynamic";

/**
 * Search product types based on keywords. If keywords is empty, it will return all available product types.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(searchPTDDefinitionHandler);
}

async function searchPTDDefinitionHandler(settings: Settings) {
  const keywords = getKeyWordsFromHeader();

  // Retrieve Search Product Types by Keywords from the SP API.
  const nextResponseOrSPAPIRequestResponse =
    await fetchSearchDefinitionsProductTypes(settings, keywords);

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  const productTypeSearchResult: ProductTypeList =
    ProductTypeList.constructFromObject(
      nextResponseOrSPAPIRequestResponse.response,
      undefined,
    );
  // @ts-ignore
  const productTypes: ProductType[] = productTypeSearchResult.productTypes;
  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: productTypes,
      debugContext: [nextResponseOrSPAPIRequestResponse],
    }),
  );
}

function getKeyWordsFromHeader() {
  const requestHeaders = headers();
  const keywords = requestHeaders.get(KEYWORDS_HEADER);
  if (keywords) {
    return keywords.split(",");
  } else {
    return [];
  }
}

/**
 * fetches the result of search product types from the SP API.
 * @param settings user entered settings
 * @param keywords search keywords
 */
async function fetchSearchDefinitionsProductTypes(
  settings: Settings,
  keywords: string[],
) {
  const definitionsApi = await buildDefinitionsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: SEARCH_DEFINITIONS_PRODUCT_TYPE_API_NAME,
    apiDocumentationLink: SEARCH_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK,
    request: {
      keywords: keywords,
      marketplaceIds: [settings.marketplaceId],
    },
    response: {},
  };

  try {
    reqResponse.response = await definitionsApi.searchDefinitionsProductTypes(
      reqResponse.request.marketplaceIds,
      {
        keywords: keywords,
      },
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}
