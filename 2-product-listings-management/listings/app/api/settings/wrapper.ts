import { Settings } from "@/app/[locale]/settings/settings";
import {
  NO_CACHING_DIRECTIVE,
  SETTINGS_API_PATH,
} from "@/app/constants/global";

/**
 * status: http response code
 * statusText: http response status text
 * settings: parsed Settings object
 */
export interface SettingsResponse {
  status: number;
  statusText: string;
  settings: Settings;
}

/**
 * Retrieves the settings.
 */
export async function getSettings(): Promise<SettingsResponse> {
  const response = await fetch(SETTINGS_API_PATH, {
    cache: NO_CACHING_DIRECTIVE,
  });
  if (response.ok) {
    const rawSettings = await response.json();
    return {
      status: response.status,
      statusText: response.statusText,
      settings: JSON.parse(rawSettings.settings),
    };
  } else {
    return {
      status: response.status,
      statusText: response.statusText,
      settings: EMPTY_SETTINGS,
    };
  }
}

export const EMPTY_SETTINGS = {
  region: "",
  accountId: "",
  clientId: "",
  clientSecret: "",
  refreshToken: "",
  sellingPartnerId: "",
  sellingPartnerIdType: "",
  marketplaceId: "",
};
