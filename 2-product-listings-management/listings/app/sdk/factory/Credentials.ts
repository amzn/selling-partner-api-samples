import {
  NO_CACHING_DIRECTIVE,
  SETTINGS_API_PATH,
  SETTINGS_KEY,
} from "@/app/constants/global";
import { createHash } from "crypto";

/**
 * Generates the SP API app credentials from the settings api.
 */
export async function getCredentialsForApiClient() {
  const response = await fetch(SETTINGS_API_PATH, {
    cache: NO_CACHING_DIRECTIVE,
  });

  // If the response is not OK, then settings api responded with non-successful status code
  if (!response.ok) {
    console.log(
      "The settings API responded with the status : " + response.status,
    );
    throw new Error("Unable to retrieve the settings data.");
  }

  try {
    const settingsApiResponseInJson = await response.json();
    const settingsDataInJsonString = settingsApiResponseInJson[SETTINGS_KEY];
    const actualSettings = JSON.parse(settingsDataInJsonString);
    const credentials = {
      clientId: actualSettings["clientId"],
      clientSecret: actualSettings["clientSecret"],
      refreshToken: actualSettings["refreshToken"],
      region: actualSettings["region"],
    };
    const credentialHash = createHash("sha512")
      .update(JSON.stringify(credentials))
      .digest("hex");

    return { ...credentials, hash: credentialHash };
  } catch (error) {
    console.log(
      "Error while parsing the response from the settings api : " + error,
    );
    throw new Error("Unable to parse the settings data from the API.", {
      cause: error,
    });
  }
}
