import nextResponse from "@/app/utils/next-response-factory";
import { Settings } from "@/app/[locale]/settings/settings";
import { NextResponse } from "next/server";
import { headers } from "next/dist/client/components/headers";
import {
  ASIN_HEADER,
  GET_LISTING_RESTRICTIONS_API_DOC_LINK,
  GET_LISTING_RESTRICTIONS_API_NAME,
  LOCALE_HEADER,
} from "@/app/constants/global";
import getSPAPIEndpoint, {
  buildListingsRestrictionsAPIClient,
} from "@/app/sdk/factory/ListingsSPAPIClientsFactory";
import {
  Restriction,
  RestrictionList,
} from "@/app/sdk/listingsRestrictions_2021-08-01";
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
 * Retrieves the conditions under which a MCID can list a given ASIN by calling SPAPI.
 */
export async function GET() {
  return retrieveSettingsAndInvokeAPILogic(getConditionTypesHandler);
}

async function getConditionTypesHandler(settings: Settings) {
  // Validate the various headers expected by the API.
  const validateHeadersResponse = validateHeaderParams();
  if (validateHeadersResponse instanceof NextResponse) {
    return validateHeadersResponse;
  }

  const { asin, locale } = validateHeadersResponse;

  // Retrieve restricted Conditions from SP API
  const nextResponseOrSPAPIResponse = await fetchRestrictions(
    settings,
    asin,
    locale,
  );
  if (nextResponseOrSPAPIResponse instanceof NextResponse) {
    return nextResponseOrSPAPIResponse;
  }
  const restrictedConditionTypes: string[] =
    RestrictionList.constructFromObject(
      nextResponseOrSPAPIResponse.response,
      undefined,
    ).restrictions.map((r: Restriction) => r.conditionType);

  const allowedTypes = Object.values(Restriction.ConditionTypeEnum).filter(
    (c) => !restrictedConditionTypes.includes(c),
  );
  return nextResponse(
    200,
    "OK",
    serializeToJsonString({
      data: allowedTypes,
      debugContext: [nextResponseOrSPAPIResponse],
    }),
  );
}

// Validates the header parameters.
function validateHeaderParams() {
  const requestHeaders = headers();
  const asin = requestHeaders.get(ASIN_HEADER);
  if (!asin) {
    const errorMessage = "The request is missing the asin in the headers";
    console.log(errorMessage);
    return nextResponse(400, errorMessage);
  }

  const locale = requestHeaders.get(LOCALE_HEADER);

  return { asin, locale };
}

/**
 * fetches the condition types from the SP API.
 * @param settings user entered settings
 * @param asin asin
 * @param locale user preferred locale.
 */
async function fetchRestrictions(
  settings: Settings,
  asin: string,
  locale: string | null,
) {
  // Build the Restrictions API Client.
  const restrictionsApi = await buildListingsRestrictionsAPIClient(
    getSPAPIEndpoint(settings.region),
  );

  const reqResponse = {
    apiName: GET_LISTING_RESTRICTIONS_API_NAME,
    apiDocumentationLink: GET_LISTING_RESTRICTIONS_API_DOC_LINK,
    request: {
      asin: asin,
      sellerId: settings.sellingPartnerId,
      marketplaceIds: [settings.marketplaceId],
      conditionType: null,
      reasonLocale: locale ? locale : "",
    },
    response: {},
  };

  try {
    reqResponse.response = await restrictionsApi.getListingsRestrictions(
      reqResponse.request.asin,
      reqResponse.request.sellerId,
      reqResponse.request.marketplaceIds,
      {
        conditionType: reqResponse.request.conditionType,
        reasonLocale: reqResponse.request.reasonLocale,
      },
    );
    return reqResponse;
  } catch (error: any) {
    return handleSPAPIInvocationError(reqResponse, error);
  }
}
