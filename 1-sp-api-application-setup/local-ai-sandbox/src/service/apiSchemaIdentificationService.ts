/**
 * Identifies which SP-API OpenAPI model (and its API name / version) applies to a request path.
 *
 * Backed entirely by the generated Operation Registry — there is no hand-maintained path map here.
 * The deterministic validation engine reads apiName/apiVersion through these functions, so the
 * registry is the single source of truth for identification.
 * See src/registry/operationRegistry.ts and res/generated/operationRegistry.json.
 */
import { identifyApiModel as registryModel, identifyApiName as registryName, identifyApiVersion as registryVersion } from "../registry/operationRegistry.js";

export const identifyApiModel = (path: string): string | undefined => registryModel(path);

export const identifyApiName = (path: string): string | undefined => registryName(path);

export const identifyApiVersion = (path: string): string | undefined => registryVersion(path);
