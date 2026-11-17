import { Settings } from "@/app/[locale]/settings/settings";

/**
 * Mock settings which can be used across tests.
 */
export const MOCK_SETTINGS: Settings = {
  region: "us-east-1",
  accountId: "123456789012",
  clientId: "clientId",
  clientSecret: "clientSecret",
  refreshToken: "refreshToken",
  sellingPartnerId: "ABCD878787R",
  sellingPartnerIdType: "Merchant Account Id",
  marketplaceId: "ATVPDKIKX0DER",
};

export const INCOMPLETE_SETTINGS: Settings = {
  region: "us-east-1",
  accountId: "123456789012",
  clientId: "clientId",
  clientSecret: "clientSecret",
  refreshToken: "refreshToken",
  sellingPartnerId: "ABCD878787R",
  sellingPartnerIdType: "Merchant Account Id",
  marketplaceId: "",
};

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

export const MOCK_VENDOR_CODE_SETTINGS: Settings = {
  region: "us-east-1",
  accountId: "123456789012",
  clientId: "clientId",
  clientSecret: "clientSecret",
  refreshToken: "refreshToken",
  sellingPartnerId: "TOTOX",
  sellingPartnerIdType: "Vendor Code",
  marketplaceId: "ATVPDKIKX0DER",
};
