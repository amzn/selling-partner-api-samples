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
 * Every version of the operation behind this endpoint, newest first: the
 * endpoints in its category sharing its ID. Two different APIs can share an
 * ID prefix (finances Invoices and tax Invoices both give
 * invoices_getInvoice), but they land in different categories. An endpoint
 * sharing both ID and version (a method twin) is not a version.
 */
export function endpointVersions(
  catalog: ApiCatalog,
  endpoint: ApiEndpoint,
): ApiEndpoint[] {
  const category = catalog.categories.find(
    (c) =>
      c.endpoints.includes(endpoint) ||
      c.subcategories?.some((s) => s.endpoints.includes(endpoint)),
  );
  const pool = category
    ? [
        ...category.endpoints,
        ...(category.subcategories ?? []).flatMap((s) => s.endpoints),
      ]
    : [endpoint];
  return pool
    .filter(
      (e) =>
        e.id === endpoint.id &&
        (e === endpoint || e.version?.current !== endpoint.version?.current),
    )
    .sort((a, b) =>
      compareVersions(b.version?.current ?? "", a.version?.current ?? ""),
    );
}

/**
 * Resolve an endpoint ID. A plain ID keeps resolving to the first version
 * loaded (unchanged behavior); {api}_{version}_{operationId} resolves to that
 * version. An operation defined with two HTTP methods (Shipping v2 PUT and
 * POST linkCarrierAccount) is told apart by a trailing _{METHOD}, or by
 * `method`; neither ever moves to another version.
 */
export function resolveEndpointId(
  catalog: ApiCatalog,
  endpointId: string,
  method?: string,
): ApiEndpoint | undefined {
  const endpoints = allEndpoints(catalog);

  const suffix = endpointId.match(/^(.+)_(GET|POST|PUT|DELETE|PATCH)$/);
  if (suffix && !endpoints.some((e) => e.id === endpointId)) {
    const twin = resolveEndpointId(catalog, suffix[1], suffix[2]);
    const hasTwin = endpoints.some(
      (e) =>
        twin !== undefined &&
        e !== twin &&
        e.id === twin.id &&
        e.version?.current === twin.version?.current,
    );
    return hasTwin && twin?.method === suffix[2] ? twin : undefined;
  }

  let candidates = endpoints.filter((e) => e.id === endpointId);
  if (candidates.length === 0) {
    const match = endpointId.match(/^([^_]+)_([^_]+)_(.+)$/);
    if (!match) {
      return undefined;
    }
    const [, prefix, version, operationId] = match;
    const plainId = `${prefix}_${operationId}`;
    candidates = endpoints.filter(
      (e) => e.id === plainId && e.version?.current === version,
    );
  }
  const first = candidates[0];
  return (
    candidates.find(
      (e) =>
        e.version?.current === first?.version?.current && e.method === method,
    ) ?? first
  );
}

/**
 * The ID to show for an endpoint: version-qualified when its plain ID is
 * shared by another endpoint in the given list, and method-qualified too
 * when another endpoint shares both ID and version; otherwise the plain ID.
 */
export function displayEndpointId(
  endpoint: ApiEndpoint,
  endpoints: ApiEndpoint[],
): string {
  const shared = endpoints.filter(
    (e) => e !== endpoint && e.id === endpoint.id,
  );
  if (shared.length === 0 || !endpoint.version?.current) {
    return endpoint.id;
  }
  const [prefix, ...rest] = endpoint.id.split("_");
  const id = `${prefix}_${endpoint.version.current}_${rest.join("_")}`;
  const twin = shared.some(
    (e) => e.version?.current === endpoint.version?.current,
  );
  return twin ? `${id}_${endpoint.method}` : id;
}
