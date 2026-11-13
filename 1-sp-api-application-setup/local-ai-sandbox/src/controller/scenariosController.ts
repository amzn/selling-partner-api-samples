import { Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { z } from "zod";
import { Api, Context } from "../database/Context.js";
import { getRegionPrimaryMarketplace, resolveRegion, REGIONS } from "../marketplaceIds.js";

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
 * - A fixture may use the placeholders {{MARKETPLACE_ID}} and {{CURRENCY}}; these are
 *   substituted with the configured region's primary marketplace and currency at load
 *   time, so a region-agnostic scenario works under any REGION.
 * - A scenario or an individual track may declare an optional `regions` allowlist. When
 *   present, the scenario is hidden (and the track dropped) outside those regions. This is
 *   how get-paid keeps its on-demand-payout tracks EU-only — the SP-API Transfers model
 *   supports those operations in the EU alone — while its Finances tracks stay portable.
 */

const SCENARIOS_DIR = "./res/scenarios";

/** Placeholder tokens substituted with region-specific values at load time. */
const MARKETPLACE_PLACEHOLDER = "{{MARKETPLACE_ID}}";
const CURRENCY_PLACEHOLDER = "{{CURRENCY}}";

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

/** Recursively substitute the marketplace/currency placeholders throughout an unknown value. */
function substituteNode(value: unknown, marketplaceId: string, currency: string): unknown {
  if (typeof value === "string") {
    return value.split(MARKETPLACE_PLACEHOLDER).join(marketplaceId).split(CURRENCY_PLACEHOLDER).join(currency);
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

/** GET /scenarios — list guided scenarios available for the configured region. */
export const listScenarios = (_request: Request, response: Response): void => {
  try {
    const scenarios = resolveScenariosForRegion().map((s) => ({
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
    response.status(200).json({ scenarios });
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    response.status(500).json({ errors: [{ code: "ScenarioLoadFailure", message: "Failed to load scenario definitions" }] });
  }
};

/** POST /scenarios/:scenarioId/seed — deterministically write the scenario's fixture data. */
export const seedScenario = (request: Request, response: Response): void => {
  const rawId = request.params.scenarioId;
  const scenarioId = Array.isArray(rawId) ? rawId[0] : rawId;

  let scenario: Scenario | undefined;
  try {
    scenario = resolveScenarioForRegion(scenarioId);
  } catch (error) {
    console.error("Failed to load scenarios:", error);
    response.status(500).json({ errors: [{ code: "ScenarioLoadFailure", message: "Failed to load scenario definitions" }] });
    return;
  }

  if (!scenario) {
    response.status(404).json({ errors: [{ code: "NotFound", message: `Scenario '${scenarioId}' not found` }] });
    return;
  }

  const engine = Context.instance.engine;
  const seededByApi: Record<string, string[]> = {};
  for (const { api, id, entity } of scenario.seed) {
    engine.put(api, id, structuredClone(entity));
    (seededByApi[api] ??= []).push(id);
  }

  response.status(200).json({
    scenarioId: scenario.id,
    title: scenario.title,
    seeded: seededByApi,
    seedCount: scenario.seed.length,
    message: `Seeded ${String(scenario.seed.length)} entities for '${scenario.title}'. Pick a track to explore.`,
  });
};
