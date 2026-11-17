import { SPAPIRequestResponse } from "@/app/model/types";
import { SettableDebugState } from "@/app/context/debug-context-provider";
import { NO_CACHING_DIRECTIVE } from "@/app/constants/global";

/**
 * Helper function to fetch the data from the backend API. This function
 * extracts the debug context, and invokes the updateDebugContextCallback
 * method.
 * @param url the url of the backend API.
 * @param updateDebugContextCallback a callback to update the debug context.
 * @param responseDataCallback an optional call back which is invoked with the
 * data extracted from the backend API.
 * @param requestInit params to initialize the fetch request.
 */
export async function fetcherForBackendAPI(
  url: string,
  updateDebugContextCallback: (debugData: any) => void,
  responseDataCallback?: (data: any) => any | void,
  requestInit?: RequestInit,
) {
  let newRequestInit = requestInit;
  if (requestInit) {
    newRequestInit = { ...requestInit, cache: NO_CACHING_DIRECTIVE };
  }

  const response = await fetch(url, newRequestInit);
  const responseBody = await response.json();
  if (responseBody.debugContext) {
    updateDebugContextCallback(responseBody.debugContext);
  }

  if (!response.ok) {
    throw [response.status, response.statusText];
  }

  const data = responseBody.data;
  if (responseDataCallback) {
    return responseDataCallback(data);
  }
  return data;
}

/**
 * Saves the given debugData for the given route into debugContext.
 * @param pathname
 * @param debugData
 * @param debugContext
 */
export function updateDebugContext(
  pathname: string,
  debugData: any,
  debugContext: SettableDebugState,
) {
  (debugData as SPAPIRequestResponse[]).forEach((value) =>
    debugContext.addRequestResponse(pathname, value),
  );
}
