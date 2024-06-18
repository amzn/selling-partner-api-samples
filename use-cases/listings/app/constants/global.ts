import {
  SELLING_PARTNER_TYPE_KEY_MERCHANT_ACCOUNT_ID,
  SELLING_PARTNER_TYPE_KEY_VENDOR_CODE,
} from "@/app/[locale]/settings/settings";

/**
 * Disables the caching in the fetch requests.
 */
export const NO_CACHING_DIRECTIVE = "no-store";
/**
 * The HTTP path where the app is accessible.
 */
export const LOCALHOST: string = "http://localhost:3000";
/**
 * AWS Region for us-east-1
 */
export const US_EAST_1 = "us-east-1";
/**
 * AWS Region for eu-west-1
 */
export const EU_WEST_1 = "eu-west-1";
/**
 * AWS Region for "us-west-2
 */
export const US_WEST_2 = "us-west-2";
/**
 * Prefix of the backend API paths.
 */
export const API_PATH: string = "/api";
/**
 * The SWR config used by all the routes.
 */
export const SWR_CONFIG_DEFAULT_VALUE: object = {
  shouldRetryOnError: false,
  errorRetryInterval: 2000,
  dedupingInterval: 0,
  revalidateOnReconnect: false,
  revalidateOnFocus: false,
  revalidateIfStale: false,
  focusThrottleInterval: 0,
  provider: () => new Map(),
};
/**
 * All APIs accept the locale using this header.
 */
export const LOCALE_HEADER = "locale";
/**
 * API path to retrieve the schema of a product type.
 */
export const PTD_DEFINITIONS_API_PATH: string = `${LOCALHOST}${API_PATH}/ptddefinitions`;
/**
 * Name of the GetDefinitionsProductType API.
 */
export const GET_DEFINITIONS_PRODUCT_TYPE_API_NAME =
  "GetDefinitionsProductType";
/**
 * Link to the documentation for the GetDefinitionsProductType API.
 */
export const GET_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/product-type-definitions-api-v2020-09-01-reference#getdefinitionsproducttype";
/**
 * Name of the SearchDefinitionsProductType API.
 */
export const SEARCH_DEFINITIONS_PRODUCT_TYPE_API_NAME =
  "SearchDefinitionsProductType";
/**
 * Link to the documentation for the SearchDefinitionsProductType API.
 */
export const SEARCH_DEFINITIONS_PRODUCT_TYPE_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/product-type-definitions-api-v2020-09-01-reference#searchdefinitionsproducttypes";
/**
 * Name of the GetListingRestrictions API.
 */
export const GET_LISTING_RESTRICTIONS_API_NAME = "GetListingRestrictions";
/**
 * Link to the documentation for the GetListingRestrictions API.
 */
export const GET_LISTING_RESTRICTIONS_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/listings-restrictions-api-v2021-08-01-reference#getlistingsrestrictions";
/**
 * Name of the SearchCatalogItems API.
 */
export const SEARCH_CATALOG_ITEMS_API_NAME = "SearchCatalogItems";
/**
 * Link to the documentation for the SearchCatalogItems API.
 */
export const SEARCH_CATALOG_ITEMS_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/catalog-items-api-v2022-04-01-reference#searchcatalogitems";
/**
 * Name of the API to retrieve the past submitted feeds.
 */
export const GET_FEEDS_API_NAME = "GetFeeds";
/**
 * Link to the documentation for the GetFeeds API.
 */
export const GET_FEEDS_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30feeds";
/**
 * Name of the API to retrieve the feed document download url.
 */
export const GET_FEED_DOCUMENT_API_NAME = "GetFeedDocument";
/**
 * Link to the documentation for the GetFeedDocument API.
 */
export const GET_FEED_DOCUMENT_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#get-feeds2021-06-30documentsfeeddocumentid";
/**
 * API path to submit listing
 */
export const LISTINGS_ITEM_API_PATH: string = `${LOCALHOST}${API_PATH}/listingsitem`;
/**
 * API to submit the feeds.
 */
export const SUBMIT_FEED_API_PATH: string = `${LOCALHOST}${API_PATH}/feeds`;
/**
 * API path to search for the catalog items.
 */
export const CATALOG_ITEMS_API_PATH: string = `${LOCALHOST}${API_PATH}/catalogitems`;
/**
 * API path to search the ptd definitions.
 */
export const PRODUCT_TYPE_DEFINITIONS_API_PATH: string = `${LOCALHOST}${API_PATH}/searchptddefinition`;
/**
 * API Path to get the details of past submitted feeds.
 */
export const FEEDS_API_PATH: string = `${LOCALHOST}${API_PATH}/feeds`;
/**
 * API Path to get the processing report url.
 */
export const FEED_DOCUMENTS_API_PATH: string = `${LOCALHOST}${API_PATH}/feeddocuments`;
/**
 * API Path for the subscriptions.
 */
export const SUBSCRIPTIONS_API_PATH: string = `${LOCALHOST}${API_PATH}/subscriptions`;
/**
 * header required for the feeddocuments GET API.
 */
export const FEED_DOCUMENT_ID_HEADER = "feedDocumentId";
/**
 * The API accepts the product type using this header.
 */
export const PRODUCT_TYPE_HEADER = "productType";
/**
 * Header required for the create subscription API.
 */
export const NOTIFICATION_TYPE_HEADER = "notificationType";
/**
 * The API accepts the use case using this header.
 */
export const USE_CASE_HEADER = "useCase";
/**
 * The API accepts the write operation using this header.
 */
export const WRITE_OPERATION_HEADER = "writeOperation";
/**
 * The API accepts mode for SP API PUT/PATCH submission using this header.
 */
export const MODE = "mode";
/**
 * The content type response header.
 */
export const CONTENT_TYPE_HEADER = "Content-Type";
/**
 * Status property from response of the SP API.
 */
export const STATUS = "status";

/**
 * API path to retrieve the allowed condition types
 */
export const CONDITION_TYPES_API_PATH: string = `${LOCALHOST}${API_PATH}/conditiontypes`;
/**
 * The API accepts the ASIN using this header.
 */
export const ASIN_HEADER = "asin";
/**
 * API accepts the Identifier Type using this header.
 */
export const IDENTIFIER_TYPES_HEADER = "identifiersType";
/**
 * API accepts the Identifiers data using this header.
 */
export const IDENTIFIERS_HEADER = "identifiers";
/**
 * API accepts the Keywords data using this header.
 */
export const KEYWORDS_HEADER = "keywords";
/**
 * API accepts the ItemName data using this header.
 */
export const ITEMNAME_HEADER = "itemname";
/**
 * API accepts the SKU data using this header.
 */
export const SKU_HEADER = "sku";
/**
 * API accepts the current listing data using this body property.
 */
export const CURRENT_LISTING_BODY = "currentListing";
/**
 * API accepts the initial listing data using this body property.
 */
export const INITIAL_LISTING_BODY = "initialListing";
/**
 * Name of the GetListingsItem API.
 */
export const GET_LISTINGS_ITEM_API_NAME = "GetListingsItem";
/**
 * Link to the documentation for the GetListingsItem API.
 */
export const GET_LISTINGS_ITEM_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference#get-listings2021-08-01itemsselleridsku";
/**
 * Name of the PutListingsItem API.
 */
export const PUT_LISTINGS_ITEM_API_NAME = "PutListingsItem";
/**
 * Link to the documentation for the PutListingsItem API.
 */
export const PUT_LISTINGS_ITEM_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference#put-listings2021-08-01itemsselleridsku";
/**
 * Name of the PatchListingsItem API.
 */
export const PATCH_LISTINGS_ITEM_API_NAME = "PatchListingsItem";
/**
 * Link to the documentation for the PatchListingsItem API.
 */
export const PATCH_LISTINGS_ITEM_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference#patch-listings2021-08-01itemsselleridsku";
/**
 * Name of the DeleteListingsItem API.
 */
export const DELETE_LISTINGS_ITEM_API_NAME = "DeleteListingsItem";
/**
 * Link to the documentation for the DeleteListingsItem API.
 */
export const DELETE_LISTINGS_ITEM_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/listings-items-api-v2021-08-01-reference#delete-listings2021-08-01itemsselleridsku";
/**
 * Name of the CreateSubscription API.
 */
export const CREATE_SUBSCRIPTION_API_NAME = "CreateSubscription";
/**
 * Link to the documentation for the CreateSubscription API.
 */
export const CREATE_SUBSCRIPTION_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference#createsubscription";
/**
 * Name of the GetSubscription API.
 */
export const GET_SUBSCRIPTION_API_NAME = "GetSubscription";
/**
 * Link to the documentation for the GetSubscription API.
 */
export const GET_SUBSCRIPTION_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference#getsubscription";
/**
 * Name of the DeleteSubscription API.
 */
export const DELETE_SUBSCRIPTION_API_NAME = "DeleteSubscriptionById";
/**
 * Link to the documentation for the DeleteSubscription API.
 */
export const DELETE_SUBSCRIPTION_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference#deletesubscriptionbyid";
/**
 * Name of the GetDestinations API.
 */
export const GET_DESTINATIONS_API_NAME = "GetDestinations";
/**
 * Link to the documentation for the GetDestinations API.
 */
export const GET_DESTINATIONS_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference#getdestinations";
/**
 * Name of the CreateDestination API.
 */
export const CREATE_DESTINATION_API_NAME = "CreateDestinations";
/**
 * Link to the documentation for the CreateDestination API.
 */
export const CREATE_DESTINATION_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-reference#post-notificationsv1destinations";
/**
 * Event Bridge destination Name.
 */
export const EVENT_BRIDGE_DESTINATION_NAME = "EventBridgeDestination";
/**
 * Constant for the Create Offer use case.
 */
export const CREATE_OFFER_USE_CASE = "CreateOffer";
/**
 * Constant for the Create Listing use case.
 */
export const CREATE_LISTING_USE_CASE = "CreateListing";
/**
 * Constant for the Update Listing use case.
 */
export const UPDATE_LISTING_USE_CASE = "UpdateListing";
/**
 * Constant for the Delete Listing use case.
 */
export const DELETE_LISTING_USE_CASE = "DeleteListing";
/**
 * List of use cases supported in the App for Put Listings Item API.
 */
export const USE_CASES_PUT_LISTINGS_ITEM = [
  CREATE_OFFER_USE_CASE,
  CREATE_LISTING_USE_CASE,
];
/**
 * List of all the use cases supported in the App for
 * Product Type Definitions API.
 */
export const USE_CASES_PRODUCT_TYPE_DEFINITION = [
  CREATE_OFFER_USE_CASE,
  CREATE_LISTING_USE_CASE,
  UPDATE_LISTING_USE_CASE,
];
/**
 * Mapping between the use case to requirements.
 */
export const USE_CASE_TO_REQUIREMENTS: Record<string, string> = {
  [CREATE_OFFER_USE_CASE]: "LISTING_OFFER_ONLY",
  [CREATE_LISTING_USE_CASE]: "LISTING",
  [UPDATE_LISTING_USE_CASE]: "LISTING",
};
/**
 * Maximum size of Feed
 */
export const MAX_FEED_SIZE_BYTES = 200000;
/**
 * JSON File type.
 */
export const JSON_FILE_TYPE = "application/json";
/**
 * Feed type of the Json Listings Feed.
 */
export const JSON_LISTINGS_FEED_TYPE = "JSON_LISTINGS_FEED";
/**
 * Name of the CreateFeedDocument API.
 */
export const CREATE_FEED_DOCUMENT_API_NAME = "CreateFeedDocument";
/**
 * Link to the documentation for the CreateFeedDocument API.
 */
export const CREATE_FEED_DOCUMENT_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#post-feeds2021-06-30documents";
/**
 * Name of the DeleteListingsItem API.
 */
export const CREATE_FEED_API_NAME = "CreateFeed";
/**
 * Link to the documentation for the DeleteListingsItem API.
 */
export const CREATE_FEED_API_DOC_LINK =
  "https://developer-docs.amazon.com/sp-api/docs/feeds-api-v2021-06-30-reference#post-feeds2021-06-30feeds";

/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#branded_item_content_change}
 */
export const BICC_NOTIFICATION_TYPE = "BRANDED_ITEM_CONTENT_CHANGE";
/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#item_product_type_change}
 */
export const IPTC_NOTIFICATION_TYPE = "ITEM_PRODUCT_TYPE_CHANGE";
/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#listings_item_status_change}
 */
export const LISC_NOTIFICATION_TYPE = "LISTINGS_ITEM_STATUS_CHANGE";
/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#listings_item_issues_change}
 */
export const LIIC_NOTIFICATION_TYPE = "LISTINGS_ITEM_ISSUES_CHANGE";
/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#listings_item_mfn_quantity_change}
 */
export const LIMQC_NOTIFICATION_TYPE = "LISTINGS_ITEM_MFN_QUANTITY_CHANGE";
/**
 * See {@link https://developer-docs.amazon.com/sp-api/docs/notifications-api-v1-use-case-guide#product_type_definitions_change}
 */
export const PTDC_NOTIFICATION_TYPE = "PRODUCT_TYPE_DEFINITIONS_CHANGE";
/**
 * List of notification types applicable for a seller.
 */
export const SELLER_NOTIFICATION_TYPES = [
  BICC_NOTIFICATION_TYPE,
  IPTC_NOTIFICATION_TYPE,
  LISC_NOTIFICATION_TYPE,
  LIIC_NOTIFICATION_TYPE,
  LIMQC_NOTIFICATION_TYPE,
  PTDC_NOTIFICATION_TYPE,
];
/**
 * List of notification types applicable for vendor.
 */
export const VENDOR_NOTIFICATION_TYPES = [
  LIIC_NOTIFICATION_TYPE,
  PTDC_NOTIFICATION_TYPE,
];
/**
 * Normalized names for the notification type which are used in the AWS Resource creation.
 */
export const NOTIFICATION_TYPE_NORM_NAMES = new Map([
  [BICC_NOTIFICATION_TYPE, "BrandedItemContentChange"],
  [IPTC_NOTIFICATION_TYPE, "ItemProductTypeChange"],
  [LISC_NOTIFICATION_TYPE, "ListingsItemStatusChange"],
  [LIIC_NOTIFICATION_TYPE, "ListingsItemIssuesChange"],
  [LIMQC_NOTIFICATION_TYPE, "ListingsItemMFNQuantityChange"],
  [PTDC_NOTIFICATION_TYPE, "ProductTypeDefinitionsChange"],
]);
/**
 * Id for the Bulk Listing Page.
 */
export const BULK_LISTING_PAGE_ID = "bulkListing";
/**
 * Path for the Bulk Listing Page.
 */
export const BULK_LISTING_PAGE_PATH = "/bulk-listing";
/**
 * Id for the Create Listing Page.
 */
export const CREATE_LISTING_PAGE_ID = "createListing";
/**
 * Path for the Create Listing Page.
 */
export const CREATE_LISTING_PAGE_PATH = "/create-listing";
/**
 * Id for the Create Offer Page.
 */
export const CREATE_OFFER_PAGE_ID = "createOffer";
/**
 * Path for the Create Offer Page.
 */
export const CREATE_OFFER_PAGE_PATH = "/create-offer";
/**
 * Id for the Delete Listing Page.
 */
export const DELETE_LISTING_PAGE_ID = "deleteListing";
/**
 * Path for the Delete Listing Page.
 */
export const DELETE_LISTING_PAGE_PATH = "/delete-listing";
/**
 * Id for the Notifications Page.
 */
export const NOTIFICATIONS_PAGE_ID = "notifications";
/**
 * Path for the Notifications Page.
 */
export const NOTIFICATIONS_PAGE_PATH = "/notifications";
/**
 * Id for the Update Listing Page.
 */
export const UPDATE_LISTING_PAGE_ID = "updateListing";
/**
 * Path for the Update Listing Page.
 */
export const UPDATE_LISTING_PAGE_PATH = "/update-listing";
/**
 * The path of the settings page.
 */
export const SETTINGS_PAGE_PATH: string = "/settings";
/**
 * en-US locale.
 */
export const US_LOCALE = "en-US";
/**
 * MarketplaceId prop inside the settings.
 */
export const MARKETPLACE_ID = "marketplaceId";
/**
 * Selling PartnerId Type prop inside the settings.
 */
export const SELLING_PARTNER_ID_TYPE = "sellingPartnerIdType";
/**
 * Selling PartnerId prop inside the settings.
 */
export const SELLING_PARTNER_ID = "sellingPartnerId";
/**
 * Refresh Token prop inside the settings.
 */
export const REFRESH_TOKEN = "refreshToken";
/**
 * Client Secret prop inside the settings.
 */
export const CLIENT_SECRET = "clientSecret";
/**
 * Client Id prop inside the settings.
 */
export const CLIENT_ID = "clientId";
/**
 * Region prop inside the settings.
 */
export const REGION = "region";
/**
 * AccountId prop inside the settings.
 */
export const ACCOUNT_ID = "accountId";
/**
 * The options which are displayed in the Selling Partner Type drop down.
 */
export const SELLING_PARTNER_TYPES = [
  {
    key: SELLING_PARTNER_TYPE_KEY_VENDOR_CODE,
    label: "Vendor Code",
  },
  {
    key: SELLING_PARTNER_TYPE_KEY_MERCHANT_ACCOUNT_ID,
    label: "Merchant Account Id",
  },
];
/**
 * The options which are the displayed in the valid Regions drop down.
 */
export const VALID_AWS_REGIONS = [
  {
    key: US_EAST_1,
    label: US_EAST_1.toUpperCase(),
  },
  {
    key: EU_WEST_1,
    label: EU_WEST_1.toUpperCase(),
  },
  {
    key: US_WEST_2,
    label: US_WEST_2.toUpperCase(),
  },
];
/**
 * URL of the Settings API.
 */
export const SETTINGS_API_PATH: string = `${LOCALHOST}${API_PATH}${SETTINGS_PAGE_PATH}`;
/**
 * Name of the AWS Secret which contains the settings data.
 */
export const SETTINGS_KEY: string = "settings";
/**
 * Validation preview mode name
 */
export const VALIDATION_PREVIEW_MODE: string = "VALIDATION_PREVIEW";
/**
 * Parentage level property name.
 */
export const VARIATION_JSON_PROPERTY = "parentage_level";
/**
 * Parent product JSON payload (parentage level).
 */
export const PARENT_JSON_PROPERTY_VALUE = {
  value: "parent",
};
/**
 * Child product JSON payload (parentage level).
 */
export const CHILD_JSON_PROPERTY_VALUE = {
  value: "child",
};
