/**
 * Object which will store the necessary settings required to make SP API calls.
 * Each field in this object corresponds to a field in the settings page.
 *
 * region: AWS Region for creating infrastructure
 * accountId: AWS AccountId for creating infrastructure
 * clientId: Client Id part of the selling partner application LWA credentials
 * clientSecret: Client Secret part of the selling partner application LWA credentials
 * refreshToken: Refresh Token used to get the access token
 * sellingPartnerId: Selling Partner Id
 * sellingPartnerIdType: A selling partner identifier type
 * marketplaceId: The MarketplaceId to be used during the Listing Process
 */
export type Settings = {
  region: string;
  accountId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sellingPartnerId: string;
  sellingPartnerIdType: string;
  marketplaceId: string;
};

/**
 * returns true if the settings are incomplete.
 * @param settings
 */
export function areSettingsIncomplete(settings: Settings) {
  return (
    !settings.region ||
    !settings.accountId ||
    !settings.clientId ||
    !settings.clientSecret ||
    !settings.refreshToken ||
    !settings.sellingPartnerId ||
    !settings.sellingPartnerIdType ||
    !settings.marketplaceId
  );
}

export const SELLING_PARTNER_TYPE_KEY_VENDOR_CODE = "Vendor Code";
export const SELLING_PARTNER_TYPE_KEY_MERCHANT_ACCOUNT_ID =
  "Merchant Account Id";
