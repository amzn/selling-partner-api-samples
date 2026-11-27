import { Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { Api, Context } from "../database/Context.js";
import { getRegionPrimaryMarketplace, resolveRegion, REGIONS } from "../marketplaceIds.js";
import { resolveKey } from "../tool/dataGenerationCore.js";

/**
 * Guided scenarios — pre-seeded, runnable SP-API journeys (parity plan, Workstream C).
 *
 * Each scenario has a shared seed (the starting world state) and multiple branching
 * tracks that explore different downstream paths from that seed.
 *
 * Seeding uses engine.put() directly and intentionally does NOT emit trigger events:
 * fixtures describe a consistent snapshot, so firing INSERT triggers would double-apply.
 *
 * Region awareness:
 * - A fixture may use the placeholders {{MARKETPLACE_ID}}, {{CURRENCY}} and {{SELLER_ID}};
 *   these are substituted with the configured region's primary marketplace and currency,
 *   and the sandbox's canonical scenario seller, at load time, so a region-agnostic
 *   scenario works under any REGION.
 * - A scenario or an individual track may declare an optional `regions` allowlist. When
 *   present, the scenario is hidden (and the track dropped) outside those regions. This is
 *   how get-paid keeps its on-demand-payout tracks EU-only — the SP-API Transfers model
 *   supports those operations in the EU alone — while its Finances tracks stay portable.
 */

const SCENARIOS_DIR = "./res/scenarios";

/** Placeholder tokens substituted with region-specific values at load time. */
const MARKETPLACE_PLACEHOLDER = "{{MARKETPLACE_ID}}";
const CURRENCY_PLACEHOLDER = "{{CURRENCY}}";
const SELLER_PLACEHOLDER = "{{SELLER_ID}}";

/**
 * The seller every scenario fixture belongs to.
 *
 * Listings are keyed by seller *and* SKU, so a fixture that omits the seller is
 * written somewhere `getListingsItem` cannot read it back. Scenarios declare
 * {{SELLER_ID}} rather than a literal, so the fixture and the runnable step
 * paths that reference it cannot disagree.
 */
export const SCENARIO_SELLER_ID = "A1SANDBOXSELLER";

const SeedEntitySchema = z.object({
  api: z.enum(Api),
  id: z.string().min(1),
  entity: z.record(z.string(), z.unknown()),
});

const StepSchema = z.object({
  title: z.string(),
  method: z.string(),
  path: z.string(),
  status: z.enum(["runnable", "pass-through", "planned"]),
  note: z.string(),
  body: z.record(z.string(), z.unknown()).optional(),
});

const RegionsSchema = z.array(z.enum(REGIONS)).min(1);

const TrackSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  description: z.string(),
  steps: z.array(StepSchema).min(1),
  /** Optional allowlist; when present the track is only shown in these regions. */
  regions: RegionsSchema.optional(),
});

const ScenarioSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string(),
  tagline: z.string(),
  description: z.string(),
  seed: z.array(SeedEntitySchema),
  tracks: z.array(TrackSchema).min(1),
  /** Optional allowlist; when present the scenario is only shown in these regions. */
  regions: RegionsSchema.optional(),
});

export type Scenario = z.infer<typeof ScenarioSchema>;
export type Track = z.infer<typeof TrackSchema>;

let cache: Map<string, Scenario> | null = null;

/** Load and validate all scenario fixtures (cached after first read). */
export function loadScenarios(): Map<string, Scenario> {
  if (cache) return cache;

  const scenarios = new Map<string, Scenario>();
  const files = fs
    .readdirSync(SCENARIOS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();

  for (const file of files) {
    const raw: unknown = JSON.parse(fs.readFileSync(path.join(SCENARIOS_DIR, file), "utf8"));
    const scenario = ScenarioSchema.parse(raw);
    if (scenarios.has(scenario.id)) {
      throw new Error(`Duplicate scenario id '${scenario.id}' in ${file}`);
    }
    scenarios.set(scenario.id, scenario);
  }

  cache = scenarios;
  return scenarios;
}

/** Test-only: drop the cache so the next call reloads from disk. */
export function __resetScenarioCacheForTests(): void {
  cache = null;
}

/** True when a `regions` allowlist is absent or includes the given region. */
function allowedInRegion(regions: readonly string[] | undefined, region: string): boolean {
  return !regions || regions.includes(region);
}

/** Recursively substitute the marketplace/currency/seller placeholders throughout an unknown value. */
function substituteNode(value: unknown, marketplaceId: string, currency: string): unknown {
  if (typeof value === "string") {
    return value
      .split(MARKETPLACE_PLACEHOLDER)
      .join(marketplaceId)
      .split(CURRENCY_PLACEHOLDER)
      .join(currency)
      .split(SELLER_PLACEHOLDER)
      .join(SCENARIO_SELLER_ID);
  }
  if (Array.isArray(value)) {
    return value.map((item) => substituteNode(item, marketplaceId, currency));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = substituteNode(item, marketplaceId, currency);
    }
    return result;
  }
  return value;
}

/**
 * Returns a structural clone of the scenario with marketplace/currency placeholders
 * resolved. The cached fixture is never mutated.
 */
function substitutePlaceholders(scenario: Scenario, marketplaceId: string, currency: string): Scenario {
  return substituteNode(scenario, marketplaceId, currency) as Scenario;
}

/**
 * Returns the scenarios visible for the configured region, with placeholders resolved
 * and region-restricted tracks dropped. Scenarios whose `regions` allowlist excludes the
 * current region are omitted entirely.
 */
export function resolveScenariosForRegion(): Scenario[] {
  const region = resolveRegion();
  const { marketplaceId, currency } = getRegionPrimaryMarketplace();

  const resolved: Scenario[] = [];
  for (const scenario of loadScenarios().values()) {
    if (!allowedInRegion(scenario.regions, region)) continue;

    const tracks = scenario.tracks.filter((track) => allowedInRegion(track.regions, region));
    if (tracks.length === 0) continue;

    resolved.push(substitutePlaceholders({ ...scenario, tracks }, marketplaceId, currency));
  }
  return resolved;
}

/** Returns a single region-resolved scenario by id, or undefined if hidden/unknown. */
export function resolveScenarioForRegion(scenarioId: string): Scenario | undefined {
  return resolveScenariosForRegion().find((s) => s.id === scenarioId);
}

/**
 * Lightweight index of the scenarios available for the configured region: one
 * line per scenario and per track, with no step detail.
 *
 * `summarizeScenarios` inlines every step of every track, which the web UI wants
 * (it fetches once and renders client-side) but an agent does not — that payload
 * grows with each scenario and most of it is irrelevant to the one track being
 * walked. Agents list with this, then fetch the one scenario they picked with
 * `describeScenario`.
 */
export function indexScenarios() {
  return resolveScenariosForRegion().map((s) => ({
    id: s.id,
    title: s.title,
    tagline: s.tagline,
    seedCount: s.seed.length,
    tracks: s.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      stepCount: t.steps.length,
      runnableCount: t.steps.filter((st) => st.status === "runnable").length,
    })),
  }));
}

/** One region-resolved scenario in full, including every track's steps. */
export function describeScenario(scenarioId: string) {
  return summarizeScenarios().find((s) => s.id === scenarioId);
}

/** Summaries of the scenarios available for the configured region (shared by HTTP and MCP). */
export function summarizeScenarios() {
  return resolveScenariosForRegion().map((s) => ({
    id: s.id,
    title: s.title,
    tagline: s.tagline,
    description: s.description,
    seedCount: s.seed.length,
    tracks: s.tracks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      steps: t.steps,
      runnableCount: t.steps.filter((st) => st.status === "runnable").length,
    })),
  }));
}

export interface SeedResult {
  scenarioId: string;
  title: string;
  seeded: Record<string, string[]>;
  seedCount: number;
  message: string;
}

/**
 * Writes a region-resolved scenario's fixture data. Returns undefined when the scenario is
 * unknown or hidden in the configured region; throws if the fixtures fail to load.
 */
export function seedScenarioById(scenarioId: string): SeedResult | undefined {
  const scenario = resolveScenarioForRegion(scenarioId);
  if (!scenario) return undefined;

  const engine = Context.instance.engine;
  const seededByApi: Record<string, string[]> = {};
  for (const { api, id, entity } of scenario.seed) {
    // Resolve the key the operation handlers read from, rather than trusting the
    // fixture's id: listings are keyed by seller *and* SKU and FBA inventory by
    // seller SKU, so a literal id would write the record where no handler looks.
    const document = structuredClone(entity);
    const resolved = resolveKey(api, id, document);
    if ("error" in resolved) {
      throw new Error(`Scenario '${scenario.id}' fixture ${api}/${id} cannot be keyed: ${resolved.error}`);
    }

    engine.put(api, resolved.key, document);
    (seededByApi[api] ??= []).push(resolved.key);
  }

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    seeded: seededByApi,
    seedCount: scenario.seed.length,
    message: `Seeded ${String(scenario.seed.length)} entities for '${scenario.title}'. Pick a track to explore.`,
  };
}

/** GET /scenarios — list guided scenarios available for the configured region. */
export const listScenarios = (_request: Request, response: Response): void => {
  try {
    response.status(200).json({ scenarios: summarizeScenarios() });
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    response.status(500).json({ errors: [{ code: "ScenarioLoadFailure", message: "Failed to load scenario definitions" }] });
  }
};

/** GET /scenarios/:scenarioId — one guided scenario in full, or 404 when unknown/hidden. */
export const getScenario = (request: Request, response: Response): void => {
  const rawId = request.params.scenarioId;
  const scenarioId = Array.isArray(rawId) ? rawId[0] : rawId;

  let scenario: ReturnType<typeof describeScenario>;
  try {
    scenario = describeScenario(scenarioId);
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    response.status(500).json({ errors: [{ code: "ScenarioLoadFailure", message: "Failed to load scenario definitions" }] });
    return;
  }

  if (!scenario) {
    response.status(404).json({ errors: [{ code: "NotFound", message: `Scenario '${scenarioId}' not found` }] });
    return;
  }

  response.status(200).json(scenario);
};

/** POST /scenarios/:scenarioId/seed — deterministically write the scenario's fixture data. */
export const seedScenario = (request: Request, response: Response): void => {
  const rawId = request.params.scenarioId;
  const scenarioId = Array.isArray(rawId) ? rawId[0] : rawId;

  let result: SeedResult | undefined;
  try {
    result = seedScenarioById(scenarioId);
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    response.status(500).json({ errors: [{ code: "ScenarioLoadFailure", message: "Failed to load scenario definitions" }] });
    return;
  }

  if (!result) {
    response.status(404).json({ errors: [{ code: "NotFound", message: `Scenario '${scenarioId}' not found` }] });
    return;
  }

  response.status(200).json(result);
};
