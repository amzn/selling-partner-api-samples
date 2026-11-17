import { NextResponse } from "next/server";
import { Settings } from "@/app/[locale]/settings/settings";
import getSPAPIEndpoint, {
  buildDefinitionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  ProductTypeDefinition,
  SchemaLink,
  SchemaLinkLink,
} from "@/app/sdk/definitionsProductTypes_2020-09-01";
import { headers } from "next/dist/client/components/headers";
import {
  GET_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK,
  GET_DEFINITIONS_PRODUCT_TYPE_API_NAME,
  LOCALE_HEADER,
  NO_CACHING_DIRECTIVE,
  PRODUCT_TYPE_HEADER,
  USE_CASE_HEADER,
  USE_CASE_TO_REQUIREMENTS,
  USE_CASES_PRODUCT_TYPE_DEFINITION,
} from "@/app/constants/global";
import nextResponse from "@/app/utils/next-response-factory";
import { SPAPIRequestResponse } from "@/app/model/types";
import { serializeToJsonString } from "@/app/utils/serialization";
import {
  handleSPAPIInvocationError,
  retrieveSettingsAndInvokeAPILogic,
} from "@/app/utils/api";
import { resolveRefs } from "json-refs";

const LATEST_VERSION = "LATEST";
const ENFORCED_REQ = "ENFORCED";

/**
 * This export forces the NextJs not to pre-render this api route.
 */
export const dynamic = "force-dynamic";

/**
 * Retrieves the schema for a product type from the Product Type Definitions API.
 * @constructor
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getPTDDefinitionHandler);
}

async function getPTDDefinitionHandler(settings: Settings) {
  // Validate the various headers expected by the API.
  const validateHeadersResponse = validateHeaderParams();
  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }
  const { productType, useCase, locale } = validateHeadersResponse;

  // Retrieve the Product Type definition from the SP API.
  const nextResponseOrSPAPIRequestResponse = await fetchProductTypeDefinition(
    settings,
    productType,
    useCase,
    locale,
  );
  if (nextResponseOrSPAPIRequestResponse instanceof NextResponse) {
    return nextResponseOrSPAPIRequestResponse;
  }

  return await fetchSchemaFromDefinition(
    nextResponseOrSPAPIRequestResponse.response,
    nextResponseOrSPAPIRequestResponse,
  );
}

// Validates the header parameters.
function validateHeaderParams() {
  const requestHeaders = headers();
  const productType = requestHeaders.get(PRODUCT_TYPE_HEADER);
  if (!productType) {
    const errorMessage =
      "The request is missing the productType in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  const useCase = requestHeaders.get(USE_CASE_HEADER);
  if (!useCase) {
    const errorMessage = "The request is missing the useCase in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  const locale = requestHeaders.get(LOCALE_HEADER);

  if (!USE_CASES_PRODUCT_TYPE_DEFINITION.includes(useCase)) {
    const errorMessage =
      "The request contains unsupported useCase in the headers : " + useCase;
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  return { productType, useCase, locale };
}

/**
 * fetches the product type definition from the SP API.
 * @param settings user entered settings
 * @param productType product type
 * @param useCase the use case where the API is called.
 * @param locale user preferred locale.
 */
async function fetchProductTypeDefinition(
  settings: Settings,
  productType: string,
  useCase: string,
  locale: string | null,
) {
  // Build the Definitions API Client.
  const definitionsApi = await buildDefinitionsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: GET_DEFINITIONS_PRODUCT_TYPE_API_NAME,
    apiDocumentationLink: GET_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK,
    request: {
      productType: productType,
      marketplaceIds: [settings.marketplaceId],
      productTypeVersion: LATEST_VERSION,
      requirementsEnforced: ENFORCED_REQ,
      sellerId: settings.sellingPartnerId,
      requirements: USE_CASE_TO_REQUIREMENTS[useCase],
      locale: locale,
    },
    response: {},
  };

  try {
    reqResponse.response = await definitionsApi.getDefinitionsProductType(
      reqResponse.request.productType,
      reqResponse.request.marketplaceIds,
      {
        productTypeVersion: reqResponse.request.productTypeVersion,
        requirementsEnforced: reqResponse.request.requirementsEnforced,
        sellerId: reqResponse.request.sellerId,
        requirements: reqResponse.request.requirements,
        locale: reqResponse.request.locale,
      },
    );

    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}

/**
 * Fetches the schema from the given product type definition.
 * @param ptdDefinitionsData
 * @param requestResponse
 */
async function fetchSchemaFromDefinition(
  ptdDefinitionsData: any,
  requestResponse: SPAPIRequestResponse,
) {
  const ptdDefinition: ProductTypeDefinition =
    ProductTypeDefinition.constructFromObject(ptdDefinitionsData, undefined);
  const schemaLink: SchemaLinkLink = (ptdDefinition.schema as SchemaLink)
    .link as SchemaLinkLink;

  try {
    const schemaURLResponse = await fetch(schemaLink.resource, {
      cache: NO_CACHING_DIRECTIVE,
      method: schemaLink.verb,
    });
    const schema = await schemaURLResponse.json();
    // Resolve the Refs in the Schema to render some deeply nested ref attributes
    // See https://jsonforms.io/docs/ref-resolving
    const refResolvedSchema = (await resolveRefs(schema)).resolved;

    return nextResponse(
      200,
      "OK",
      serializeToJsonString({
        data: refResolvedSchema,
        debugContext: [requestResponse],
      }),
    );
  } catch (error) {
    // Generally these errors are recoverable.
    const errorMessage = "Error while fetching the schema from SchemaLink.";
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
