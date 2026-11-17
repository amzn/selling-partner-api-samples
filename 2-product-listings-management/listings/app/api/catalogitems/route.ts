import { NextResponse } from "next/server";
import { headers } from "next/dist/client/components/headers";
import getSPAPIEndpoint, {
  buildCatalogItemsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  IDENTIFIER_TYPES_HEADER,
  IDENTIFIERS_HEADER,
  KEYWORDS_HEADER,
  SEARCH_CATALOG_ITEMS_API_DOC_LINK,
  SEARCH_CATALOG_ITEMS_API_NAME,
  LOCALE_HEADER,
} from "@/app/constants/global";
import nextResponse from "@/app/utils/next-response-factory";
import { Item, ItemSearchResults } from "@/app/sdk/catalogItems_2022-04-01";
import { ProductSearchResult } from "@/app/[locale]/create-offer/product-result-type";
import { Settings } from "@/app/[locale]/settings/settings";
import { SPAPIRequestResponse } from "@/app/model/types";
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
 * Retrieves the list of Catalog Items based on identifiers/keywords by calling the SearchCatalogItems SP-API.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getCatalogItemsHandler);
}

async function getCatalogItemsHandler(settings: Settings) {
  const { identifiersType, identifiers, keywords, locale } =
    retrieveRequestParamsFromHeader();
  const optionalParams = constructOptionalParametersForApi(
    settings,
    identifiersType,
    identifiers,
    keywords,
    locale,
  );
  const nextResponseOrSPAPIRequestResponse = await fetchCatalogItems(
    settings,
    optionalParams,
  );

  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  return fetchItemSearchResults(nextResponseOrSPAPIRequestResponse);
}

function retrieveRequestParamsFromHeader() {
  const requestHeaders = headers();
  const identifiersType = requestHeaders.get(IDENTIFIER_TYPES_HEADER);
  const identifierData = requestHeaders.get(IDENTIFIERS_HEADER);
  const identifiers = identifierData ? identifierData.split(",") : null;
  const keywordsData = requestHeaders.get(KEYWORDS_HEADER);
  const keywords = keywordsData ? keywordsData.split(",") : null;
  const locale = requestHeaders.get(LOCALE_HEADER);

  return { identifiersType, identifiers, keywords, locale };
}

function constructOptionalParametersForApi(
  settings: Settings,
  identifiersType: string | null,
  identifiers: string[] | null,
  keywords: string[] | null,
  locale: string | null,
) {
  const includedData = ["productTypes", "summaries"];

  if (identifiers) {
    const optionalParametersForIdentifiers = {
      identifiers: identifiers,
      identifiersType: identifiersType,
      includedData: includedData,
      locale: locale,
    };

    // Seller ID is mandatory when identifier Type is SKU
    if (identifiersType === "SKU") {
      return {
        sellerId: settings.sellingPartnerId,
        ...optionalParametersForIdentifiers,
      };
    }

    // For non-SKU Identifier Type use case.
    return optionalParametersForIdentifiers;
  }

  if (keywords) {
    return {
      keywords: keywords,
      includedData: includedData,
      locale: locale,
    };
  }
}

async function fetchCatalogItems(settings: Settings, opts: any) {
  // Build Catalog Items API Client.
  const catalogApi = await buildCatalogItemsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: SEARCH_CATALOG_ITEMS_API_NAME,
    apiDocumentationLink: SEARCH_CATALOG_ITEMS_API_DOC_LINK,
    request: {
      marketplaceIds: [settings.marketplaceId],
      ...opts,
    },
    response: {},
  };
  try {
    reqResponse.response = await catalogApi.searchCatalogItems(
      reqResponse.request.marketplaceIds,
      opts,
    );
    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}

function deriveTitle(item: Item) {
  return item.summaries?.[0]?.itemName;
}

function derivePTD(item: Item) {
  return item.productTypes?.[0]?.productType;
}

function fetchItemSearchResults(reqResponse: SPAPIRequestResponse) {
  const searchResults: ItemSearchResults =
    ItemSearchResults.constructFromObject(reqResponse.response, undefined);

  if (searchResults.numberOfResults && searchResults.numberOfResults > 0) {
    // @ts-ignore
    const items: Item[] = searchResults.items;
    const results: ProductSearchResult[] = items.map((item, index) => {
      const searchResult: ProductSearchResult = {
        title: deriveTitle(item),
        asin: item.asin,
        productType: derivePTD(item),
      };
      return searchResult;
    });
    return nextResponse(
      200,
      "OK",
      serializeToJsonString({
        data: results,
        debugContext: [reqResponse],
      }),
    );
  }

  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: [],
      debugContext: [reqResponse],
    }),
  );
}
