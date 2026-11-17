import nextResponse from "@/app/utils/next-response-factory";
import { getSettings, SettingsResponse } from "@/app/api/settings/wrapper";
import { serializeToJsonString } from "@/app/utils/serialization";
import { STATUS } from "@/app/constants/global";
import { SPAPIRequestResponse } from "@/app/model/types";
import { Settings } from "@/app/[locale]/settings/settings";
import { NextRequest, NextResponse } from "next/server";

/**
 * Generic Error Message which is sent in the API response.
 */
const ERROR_MESSAGE = "Unexpected error during API execution.";

/**
 * Helper function to build 500 HTTP response on settings fetch failure.
 */
export async function retrieveSettingsData() {
  const settingsResponse: SettingsResponse = await getSettings();

  if (settingsResponse.status !== 200) {
    const errorMessage =
      "Unable to retrieve the settings due to " + settingsResponse.statusText;
    console.log(errorMessage);
    return nextResponse(500, errorMessage);
  }

  return settingsResponse.settings;
}

/**
 * Helper method which retrieves the settings and invokes the API logic.
 * @param apiLogic the function which executes the api logic.
 */
export async function retrieveSettingsAndInvokeAPILogic(
  apiLogic: (settings: Settings) => Promise<NextResponse>,
) {
  try {
    const settingsResponse = await retrieveSettingsData();

    if (settingsResponse instanceof NextResponse) {
      return settingsResponse;
    }

    const settings: Settings = settingsResponse;
    return apiLogic(settings);
  } catch (error) {
    return nextResponse(500, ERROR_MESSAGE, serializeToJsonString({}));
  }
}

/**
 * Helper method which retrieves the settings and invokes the API logic with next request.
 * @param apiLogic the function which executes the api logic.
 * @param apiRequest the next request.
 */
export async function retrieveSettingsAndInvokeAPILogicWithRequest(
  apiLogic: (
    settings: Settings,
    apiRequest: NextRequest,
  ) => Promise<NextResponse>,
  apiRequest: NextRequest,
) {
  try {
    const settingsResponse = await retrieveSettingsData();

    if (settingsResponse instanceof NextResponse) {
      return settingsResponse;
    }

    const settings: Settings = settingsResponse;
    return apiLogic(settings, apiRequest);
  } catch (error) {
    return nextResponse(500, ERROR_MESSAGE, serializeToJsonString({}));
  }
}

/**
 * Helper function to handle any error from the SP API.
 * @param reqResponse the object to store the SP API request and response.
 * @param error SP API error.
 */
export function handleSPAPIInvocationError(
  reqResponse: SPAPIRequestResponse,
  error: any,
) {
  reqResponse.response = error;
  // The error is generally the Error object from the superagent.
  const errorMessage = ERROR_MESSAGE;
  console.log(errorMessage + " " + serializeToJsonString(error));

  // Proxy the status from the SP API.
  let status = 500;
  if (error instanceof Object && error.hasOwnProperty(STATUS)) {
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

/**
 * Helper function to handle any error from the SP API where multiple SP APIs are chained within a single request.
 * @param error SP API error.
 * @param debugContext List where debug context will be appended. Use the same list for all calls.
 * @param reqResponse the object to store the SP API request and response.
 */
export function handleChainedSPAPIInvocationError(
  error: any,
  debugContext: any[],
  reqResponse?: SPAPIRequestResponse,
) {
  if (reqResponse) {
    reqResponse.response = error;
    debugContext.push(reqResponse);
  }

  // The error is generally the Error object from the superagent.
  const errorMessage = ERROR_MESSAGE;
  console.log(errorMessage + " " + serializeToJsonString(error));

  // Proxy the status from the SP API.
  let status = 500;
  if (error instanceof Object && error.hasOwnProperty(STATUS)) {
    status = error.status;
  }

  return nextResponse(
    status,
    errorMessage,
    serializeToJsonString({
      debugContext: debugContext,
    }),
  );
}
