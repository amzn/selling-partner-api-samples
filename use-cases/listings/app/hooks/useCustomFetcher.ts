import { usePathname } from "next/navigation";
import { useContext } from "react";
import { DebugContext } from "@/app/context/debug-context-provider";
import { fetcherForBackendAPI, updateDebugContext } from "@/app/utils/fetch";

/**
 * A custom hook which is used to build the fetcher to invoke the backend API.
 * @param requestInitBuilder function to build RequestInit from the fetcher keys.
 * @param responseDataCallbackBuilder function to build the response data callback function.
 */
export function useCustomFetcher(
  requestInitBuilder?: (fetcherKeys: string[]) => RequestInit | undefined,
  responseDataCallbackBuilder?: (fetcherKeys: string[]) => (data: any) => void,
) {
  const pathname = usePathname();
  const debugContext = useContext(DebugContext);
  return (keys: string[]) =>
    fetcherForBackendAPI(
      keys[0],
      (debugData: any) => updateDebugContext(pathname, debugData, debugContext),
      responseDataCallbackBuilder
        ? responseDataCallbackBuilder(keys)
        : undefined,
      requestInitBuilder ? requestInitBuilder(keys) : undefined,
    );
}
