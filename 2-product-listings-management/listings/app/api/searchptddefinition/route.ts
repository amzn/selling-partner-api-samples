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
  ITEMNAME_HEADER,
  LOCALE_HEADER,
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
 * Search product types based on keywords or itemname. If both are empty, it will return all available product types.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(searchPTDDefinitionHandler);
}

async function searchPTDDefinitionHandler(settings: Settings) {
  const { keywords, itemName, locale } = retrieveRequestParamsFromHeader();

  // Retrieve Search Product Types by Keywords or ItemName from the SP API.
  const nextResponseOrSPAPIRequestResponse =
    await fetchSearchDefinitionsProductTypes(
      settings,
      keywords,
      itemName,
      locale,
    );

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

function retrieveRequestParamsFromHeader() {
  const requestHeaders = headers();
  const keywordsData = requestHeaders.get(KEYWORDS_HEADER);
  const keywords = keywordsData ? keywordsData.split(",") : [];
  const itemNameData = requestHeaders.get(ITEMNAME_HEADER);
  const itemName = itemNameData ? itemNameData : "";
  const localeData = requestHeaders.get(LOCALE_HEADER);
  const locale = localeData ? localeData : "";

  return { keywords, itemName, locale };
}

/**
 * fetches the result of search product types from the SP API.
 * @param settings user entered settings
 * @param keywords search keywords
 * @param itemName search itemName
 * @param locale user preferred locale
 */
async function fetchSearchDefinitionsProductTypes(
  settings: Settings,
  keywords: string[],
  itemName: string,
  locale: string,
) {
  const definitionsApi = await buildDefinitionsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: SEARCH_DEFINITIONS_PRODUCT_TYPE_API_NAME,
    apiDocumentationLink: SEARCH_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK,
    request: {
      keywords: keywords,
      itemName: itemName,
      marketplaceIds: [settings.marketplaceId],
      locale: locale,
      searchLocale: locale,
    },
    response: {},
  };

  try {
    reqResponse.response = await definitionsApi.searchDefinitionsProductTypes(
      reqResponse.request.marketplaceIds,
      {
        keywords: keywords,
        itemName: itemName,
        locale: locale,
        searchLocale: locale,
      },
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}
