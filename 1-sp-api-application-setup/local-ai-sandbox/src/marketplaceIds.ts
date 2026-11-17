/**
 * Centralized marketplace ID definitions by region.
 *
 * NA: US, CA, MX, BR
 * EU: DE, IE, ES, UK, FR, BE, NL, IT, SE, ZA, PL, EG, TR, SA, AE, IN
 * FE: JP, AU, SG
 */

export const MARKETPLACE_IDS_NA = ["ATVPDKIKX0DER", "A2EUQ1WTGCTBG2", "A1AM78C64UM0Y8", "A2Q3Y263D00KWC"] as const;

export const MARKETPLACE_IDS_EU = [
  "A1PA6795UKMFR9",
  "A28R8C7NBKEWEA",
  "A1RKKUPIHCS9HS",
  "A1F83G8C2ARO7P",
  "A13V1IB3VIYZZH",
  "AMEN7PMS3EDWL",
  "A1805IZSGTT6HS",
  "APJ6JRA9NG5V4",
  "A2NODRKZP88ZB9",
  "AE08WJ6YKNBMC",
  "A1C3SOZRARQ6R3",
  "ARBP9OOSHTCHU",
  "A33AVAJ2PDY3EV",
  "A17E79C6D8DWNP",
  "A2VIGQ35RCS4UG",
  "A21TJRUUN4KGV",
] as const;

export const MARKETPLACE_IDS_FE = ["A1VC38T7YXB528", "A39IBJ37TRP1C6", "A19VAU5U5O7RUS"] as const;

export const MARKETPLACE_IDS_ALL = [...MARKETPLACE_IDS_NA, ...MARKETPLACE_IDS_EU, ...MARKETPLACE_IDS_FE] as const;

export const MARKETPLACE_IDS_BY_REGION: Record<string, readonly string[]> = {
  NA: MARKETPLACE_IDS_NA,
  EU: MARKETPLACE_IDS_EU,
  FE: MARKETPLACE_IDS_FE,
};

// --- Marketplace-to-Currency Mapping ---

export const MARKETPLACE_CURRENCY_MAP: Record<string, string> = {
  ATVPDKIKX0DER: "USD", // US
  A2EUQ1WTGCTBG2: "CAD", // CA
  A1AM78C64UM0Y8: "MXN", // MX
  A2Q3Y263D00KWC: "BRL", // BR
  A1VC38T7YXB528: "JPY", // JP
  A39IBJ37TRP1C6: "AUD", // AU
  A19VAU5U5O7RUS: "SGD", // SG
  A1F83G8C2ARO7P: "GBP", // UK
  A1PA6795UKMFR9: "EUR", // DE
  A13V1IB3VIYZZH: "EUR", // FR
  APJ6JRA9NG5V4: "EUR", // IT
  AMEN7PMS3EDWL: "EUR", // BE
  A1805IZSGTT6HS: "EUR", // NL
  A2NODRKZP88ZB9: "SEK", // SE
  A1C3SOZRARQ6R3: "PLN", // PL
  AE08WJ6YKNBMC: "ZAR", // ZA
  A33AVAJ2PDY3EV: "TRY", // TR
  ARBP9OOSHTCHU: "EGP", // EG
  A21TJRUUN4KGV: "INR", // IN
  A28R8C7NBKEWEA: "EUR", // IE
  A1RKKUPIHCS9HS: "EUR", // ES
  A17E79C6D8DWNP: "SAR", // SA
  A2VIGQ35RCS4UG: "AED", // AE
};

/** The regions the sandbox understands. */
export const REGIONS = ["NA", "EU", "FE"] as const;
export type Region = (typeof REGIONS)[number];

/**
 * Resolves the configured region from process.env.REGION.
 * Defaults to "NA" if unset or invalid.
 */
export function resolveRegion(): Region {
  const value = process.env.REGION;
  return value && (REGIONS as readonly string[]).includes(value) ? (value as Region) : "NA";
}

/**
 * Returns the set of allowed marketplace IDs for the configured region.
 * Reads REGION from process.env; defaults to "NA" if unset or invalid.
 */
export function getAllowedMarketplaceIds(): readonly string[] {
  return MARKETPLACE_IDS_BY_REGION[resolveRegion()];
}

/**
 * Returns the primary (first-listed) marketplace ID for the configured region
 * together with its currency. Used to parameterize region-agnostic fixtures.
 */
export function getRegionPrimaryMarketplace(): { marketplaceId: string; currency: string } {
  const marketplaceId = getAllowedMarketplaceIds()[0];
  return { marketplaceId, currency: MARKETPLACE_CURRENCY_MAP[marketplaceId] ?? "USD" };
}
