import {
  NotificationsApi,
  ApiClient as NotificationsApiClient,
} from "@/app/sdk/notifications";
import {
  CatalogApi,
  ApiClient as CatalogApiClient,
} from "@/app/sdk/catalogItems_2022-04-01";
import {
  DefinitionsApi,
  ApiClient as DefinitionsApiClient,
} from "@/app/sdk/definitionsProductTypes_2020-09-01";
import {
  ListingsApi,
  ApiClient as ListingsApiClient,
} from "@/app/sdk/listingsItems_2021-08-01";
import {
  ListingsApi as ListingsRestrictionsApi,
  ApiClient as ListingsRestrictionsApiClient,
} from "@/app/sdk/listingsRestrictions_2021-08-01";
import {
  FeedsApi,
  ApiClient as FeedsApiClient,
} from "@/app/sdk/feeds_2021-06-30";
import { getCredentialsForApiClient } from "@/app/sdk/factory/Credentials";
import { EU_WEST_1, US_EAST_1, US_WEST_2 } from "@/app/constants/global";

const CACHED_CLIENTS = new Map<string, any>();

const CATALOG_API = "catalogApi";
const DEFINITIONS_API = "definitionsApi";
const LISTINGS_API = "listingsApi";
const LISTING_RESTRICTIONS_API = "listingsRestrictionsApi";
const FEEDS_API = "feedsApi";
const NOTIFICATIONS_API = "notificationsApi";
const SCOPE_BASED_NOTIFICATIONS_API = "scopeBasedNotificationsApi";

/**
 * Helper method which provides the right SP API endpoint to use based on the AWS Region. See
 * https://developer-docs.amazon.com/sp-api/docs/sp-api-endpoints
 * @param awsRegion the string representation of the AWS Region like 'us-east-1', 'eu-west-1' etc.
 * @return the SP API endpoint for the associated AWS region.
 */
export default function getSPAPIEndpoint(awsRegion: string): string {
  switch (awsRegion) {
    case US_EAST_1:
      return `https://sellingpartnerapi-na.amazon.com`;
    case EU_WEST_1:
      return `https://sellingpartnerapi-eu.amazon.com`;
    case US_WEST_2:
      return `https://sellingpartnerapi-fe.amazon.com`;
    default:
      throw new Error(awsRegion + " is not supported by the SP API.");
  }
}

/**
 * Builds the client to access the Catalog Items API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of CatalogApi.
 */
export async function buildCatalogItemsAPIClient(
  spApiUrl: string,
): Promise<CatalogApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    CATALOG_API,
  );
  let catalogApi = CACHED_CLIENTS.get(cacheKey);
  if (catalogApi) {
    return catalogApi as CatalogApi;
  }

  const catalogApiClient: CatalogApiClient = new CatalogApiClient(spApiUrl);
  catalogApi = new CatalogApi(catalogApiClient);
  catalogApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, catalogApi);
  return catalogApi;
}

/**
 * Builds the client to access the Product Type Definitions API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of DefinitionsApi.
 */
export async function buildDefinitionsAPIClient(
  spApiUrl: string,
): Promise<DefinitionsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    DEFINITIONS_API,
  );
  let definitionsApi = CACHED_CLIENTS.get(cacheKey);
  if (definitionsApi) {
    return definitionsApi as DefinitionsApi;
  }

  const definitionsApiClient = new DefinitionsApiClient(spApiUrl);
  definitionsApi = new DefinitionsApi(definitionsApiClient);
  definitionsApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, definitionsApi);
  return definitionsApi;
}

/**
 * Builds the client to access the Listings Items API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of ListingsApi.
 */
export async function buildListingsItemsAPIClient(
  spApiUrl: string,
): Promise<ListingsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    LISTINGS_API,
  );

  let listingsApi = CACHED_CLIENTS.get(cacheKey);
  if (listingsApi) {
    return listingsApi as ListingsApi;
  }

  const listingsApiClient = new ListingsApiClient(spApiUrl);
  listingsApi = new ListingsApi(listingsApiClient);
  listingsApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, listingsApi);
  return listingsApi;
}

/**
 * Builds the client to access the Listings Restrictions API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of ListingsRestrictionsApi.
 */
export async function buildListingsRestrictionsAPIClient(
  spApiUrl: string,
): Promise<ListingsRestrictionsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    LISTING_RESTRICTIONS_API,
  );

  let listingsRestrictionsApi = CACHED_CLIENTS.get(cacheKey);
  if (listingsRestrictionsApi) {
    return listingsRestrictionsApi as ListingsRestrictionsApi;
  }

  const listingsRestrictionsApiClient = new ListingsRestrictionsApiClient(
    spApiUrl,
  );
  listingsRestrictionsApi = new ListingsRestrictionsApi(
    listingsRestrictionsApiClient,
  );
  listingsRestrictionsApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, listingsRestrictionsApi);
  return listingsRestrictionsApi;
}

/**
 * Builds the client to access the Feeds API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of FeedsApi.
 */
export async function buildFeedsAPIClient(spApiUrl: string): Promise<FeedsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    FEEDS_API,
  );

  let feedsApi = CACHED_CLIENTS.get(cacheKey);
  if (feedsApi) {
    return feedsApi as FeedsApi;
  }

  const feedsApiClient = new FeedsApiClient(spApiUrl);
  feedsApi = new FeedsApi(feedsApiClient);
  feedsApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, feedsApi);
  return feedsApi;
}

/**
 * Builds the client to access the Notifications API of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of NotificationsApi.
 */
export async function buildNotificationsAPIClient(
  spApiUrl: string,
): Promise<NotificationsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    NOTIFICATIONS_API,
  );

  let notificationsApi = CACHED_CLIENTS.get(cacheKey);
  if (notificationsApi) {
    return notificationsApi as NotificationsApi;
  }

  const notificationsApiClient = new NotificationsApiClient(spApiUrl);
  notificationsApi = new NotificationsApi(notificationsApiClient);
  notificationsApiClient.enableAutoRetrievalAccessToken(
    credentials.clientId,
    credentials.clientSecret,
    credentials.refreshToken,
  );

  CACHED_CLIENTS.set(cacheKey, notificationsApi);
  return notificationsApi;
}

/**
 * Builds the client to access the grant less Notifications APIs of the SP API.
 * @param spApiUrl the SP API endpoint.
 * @return the Promise of NotificationsApi.
 */
export async function buildGrantLessNotificationsAPIClient(
  spApiUrl: string,
): Promise<NotificationsApi> {
  const { credentials, cacheKey } = await retrieveCredentialsAndComputeCacheKey(
    SCOPE_BASED_NOTIFICATIONS_API,
  );

  let notificationsApi = CACHED_CLIENTS.get(cacheKey);
  if (notificationsApi) {
    return notificationsApi as NotificationsApi;
  }

  const notificationsApiClient = new NotificationsApiClient(spApiUrl);
  notificationsApiClient.enableAutoRetrievalAccessTokenForScopes(
    credentials.clientId,
    credentials.clientSecret,
    ["sellingpartnerapi::notifications"],
  );

  notificationsApi = new NotificationsApi(notificationsApiClient);
  CACHED_CLIENTS.set(cacheKey, notificationsApi);
  return notificationsApi;
}

function computeCacheKey(api: string, credentialHash: string) {
  return `${api}-${credentialHash}`;
}

async function retrieveCredentialsAndComputeCacheKey(api: string) {
  const credentials = await getCredentialsForApiClient();
  const cacheKey = computeCacheKey(credentials.hash, api);
  return { credentials, cacheKey };
}
