// src/catalog/endpoint-resolver.ts

import { ApiCatalog, ApiEndpoint } from "../types/api-catalog.js";

/**
 * Several APIs ship more than one version with the same operationIds
 * (e.g. Catalog Items 2020-12-01 and 2022-04-01), so their endpoints share
 * one ID. These helpers give each version its own ID,
 * {api}_{version}_{operationId}, and list an operation's versions.
 */

/**
 * Compare two API version strings. Dated versions (2022-04-01) are newer than
 * v-numbered ones (v0, v1). Returns a positive number when a is newer.
 */
export function compareVersions(a: string, b: string): number {
  const rank = (v: string): [number, string] => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return [1, v];
    const n = v.match(/^v(\d+)$/i);
    return [0, n ? n[1].padStart(6, "0") : v];
  };
  const [ra, sa] = rank(a);
  const [rb, sb] = rank(b);
  if (ra !== rb) return ra - rb;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * All endpoints in catalog order, including subcategories
 */
export function allEndpoints(catalog: ApiCatalog): ApiEndpoint[] {
  return catalog.categories.flatMap((category) => [
    ...category.endpoints,
    ...(category.subcategories ?? []).flatMap((s) => s.endpoints),
  ]);
}

/**
 * Every version of the operation behind this endpoint (endpoints sharing its
 * ID), newest first
 */
export function endpointVersions(
  catalog: ApiCatalog,
  endpoint: ApiEndpoint,
): ApiEndpoint[] {
  return allEndpoints(catalog)
    .filter((e) => e.id === endpoint.id)
    .sort((a, b) =>
      compareVersions(b.version?.current ?? "", a.version?.current ?? ""),
    );
}

/**
 * Resolve an endpoint ID. A plain ID keeps resolving to the first version
 * loaded (unchanged behavior); {api}_{version}_{operationId} resolves to that
 * version.
 */
export function resolveEndpointId(
  catalog: ApiCatalog,
  endpointId: string,
): ApiEndpoint | undefined {
  const endpoints = allEndpoints(catalog);

  const exact = endpoints.find((e) => e.id === endpointId);
  if (exact) {
    return exact;
  }

  const match = endpointId.match(/^([^_]+)_([^_]+)_(.+)$/);
  if (!match) {
    return undefined;
  }
  const [, prefix, version, operationId] = match;
  const plainId = `${prefix}_${operationId}`;
  return endpoints.find(
    (e) => e.id === plainId && e.version?.current === version,
  );
}

/**
 * The ID to show for an endpoint: version-qualified when its plain ID is
 * shared by another endpoint in the given list, otherwise the plain ID.
 */
export function displayEndpointId(
  endpoint: ApiEndpoint,
  endpoints: ApiEndpoint[],
): string {
  const shared = endpoints.some((e) => e !== endpoint && e.id === endpoint.id);
  if (!shared || !endpoint.version?.current) {
    return endpoint.id;
  }
  const [prefix, ...rest] = endpoint.id.split("_");
  return `${prefix}_${endpoint.version.current}_${rest.join("_")}`;
}
