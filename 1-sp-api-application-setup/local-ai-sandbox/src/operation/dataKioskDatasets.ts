import type { Mode } from "../registry/operationRegistry.js";
import type { ParsedQuery } from "./dataKioskQueryParser.js";

/**
 * Deterministic dataset registry for Data Kiosk Level B.
 *
 * Each entry declares which modes may query it, a representative static JSONL
 * sample (for docs/tests), and a deterministic `generate` that turns a parsed
 * query into JSONL. Adding a dataset requires no handler changes.
 */

export type Outcome = "DATA" | "NO_DATA" | "FATAL";

export interface DatasetDefinition {
  supportedModes: Mode[];
  /** Representative JSONL sample (one JSON object per line). */
  sample: string;
  /** Deterministic JSONL generator. Returns "" to signal the no-data branch. */
  generate: (q: ParsedQuery) => string;
  /** When true, any query for this dataset is classified FATAL (simulated failure). */
  alwaysFails?: boolean;
}

/**
 * Fixed reference "today" so that "range entirely in the future" (the no-data
 * branch) is deterministic and independent of the wall clock.
 */
export const DATASET_REFERENCE_DATE = "2024-01-31";

/** Marker token that forces a query to a simulated FATAL processing failure. */
export const FATAL_MARKER = "FATAL_TEST";

/** Deterministic seeded ASINs for salesAndTrafficByAsin generation. */
const SEEDED_ASINS = ["B0SANDBOX01", "B0SANDBOX02", "B0SANDBOX03"];

// --- Deterministic helpers (no randomness) ---

/**
 * A stable non-negative 32-bit hash of a string, used to derive deterministic
 * metrics. Uses `>>> 0` (unsigned right shift) to fold into the unsigned 32-bit
 * range, which — unlike `Math.abs(h | 0)` — has no negative edge case
 * (`Math.abs(-2147483648)` overflows back to a negative value).
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/**
 * Maximum number of days a single query will materialize. Real Data Kiosk
 * paginates large result sets; the sandbox does not implement result pagination,
 * so this cap bounds document size and prevents a pathological wide date range
 * from synthesizing an unbounded document in memory.
 */
export const MAX_GENERATED_ROWS = 400;

/**
 * Inclusive list of ISO dates (YYYY-MM-DD) from start to end, capped at the fixed
 * reference date (the sandbox has no data for the future) and at MAX_GENERATED_ROWS
 * days total. Empty if start > end, start is after the reference date, or the
 * inputs are missing/invalid.
 *
 * All arithmetic is anchored to UTC midnight (`...T00:00:00Z`) and each day is
 * emitted via `toISOString().slice(0, 10)`, so the iteration is DST-immune —
 * adding a fixed 24h never skips or duplicates a calendar day.
 */
export function datesInRange(start: string | undefined, end: string | undefined): string[] {
  if (!start || !end) return [];
  const startMs = Date.parse(`${start}T00:00:00Z`);
  const referenceMs = Date.parse(`${DATASET_REFERENCE_DATE}T00:00:00Z`);
  // Cap the end at the reference date — no data exists beyond "today".
  const endMs = Math.min(Date.parse(`${end}T00:00:00Z`), referenceMs);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) return [];
  const days: string[] = [];
  const DAY = 24 * 60 * 60 * 1000;
  for (let t = startMs; t <= endMs && days.length < MAX_GENERATED_ROWS; t += DAY) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

function marketplaceId(q: ParsedQuery): string {
  return q.marketplaceIds[0] ?? "ATVPDKIKX0DER";
}

/**
 * Groups the inclusive in-range dates into buckets according to `aggregateBy`,
 * so generation can emit one row per period. Each bucket is `[startDate, endDate]`
 * (the first and last in-range day of the period).
 *
 * - DAY (default / unknown): one bucket per day.
 * - WEEK: buckets keyed by ISO year-week (Monday-based).
 * - MONTH: buckets keyed by year-month.
 *
 * Buckets preserve chronological order and are clipped to the actual in-range
 * days (a partial leading/trailing week or month spans only the days present).
 */
function bucketDates(dates: string[], aggregateBy: string | undefined): { startDate: string; endDate: string }[] {
  const period = (aggregateBy ?? "DAY").toUpperCase();
  if (period !== "WEEK" && period !== "MONTH") {
    return dates.map((d) => ({ startDate: d, endDate: d }));
  }

  const keyOf = (isoDate: string): string => {
    const ms = Date.parse(`${isoDate}T00:00:00Z`);
    const d = new Date(ms);
    if (period === "MONTH") {
      return `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    }
    // WEEK: key by the UTC Monday that starts the week.
    const dayOfWeek = (d.getUTCDay() + 6) % 7; // 0 = Monday
    const monday = new Date(ms - dayOfWeek * 24 * 60 * 60 * 1000);
    return monday.toISOString().slice(0, 10);
  };

  const buckets = new Map<string, { startDate: string; endDate: string }>();
  for (const date of dates) {
    const key = keyOf(date);
    const existing = buckets.get(key);
    if (existing) {
      existing.endDate = date; // dates are chronological, so this extends the bucket
    } else {
      buckets.set(key, { startDate: date, endDate: date });
    }
  }
  return [...buckets.values()];
}

// --- salesAndTraffic (Seller) generation ---

function salesAndTrafficByDate(q: ParsedQuery): string {
  const mp = marketplaceId(q);
  return bucketDates(datesInRange(q.startDate, q.endDate), q.aggregateBy)
    .map(({ startDate, endDate }) => {
      const seed = hashString(`${startDate}:${endDate}:${mp}`);
      const amount = 1000 + (seed % 9000) + (seed % 100) / 100;
      return JSON.stringify({
        startDate,
        endDate,
        marketplaceId: mp,
        sales: {
          orderedProductSales: { amount: Number(amount.toFixed(2)), currencyCode: "USD" },
          unitsShipped: 20 + (seed % 80),
          unitsOrdered: 25 + (seed % 90),
        },
        traffic: { browserPageViews: 100 + (seed % 900), browserSessions: 50 + (seed % 500) },
      });
    })
    .join("\n");
}

function salesAndTrafficByAsin(q: ParsedQuery): string {
  const mp = marketplaceId(q);
  // Derive the emitted window from the reference-capped range so byAsin never
  // reports dates beyond DATASET_REFERENCE_DATE (consistent with byDate). No rows
  // for an empty/invalid range.
  const days = datesInRange(q.startDate, q.endDate);
  if (days.length === 0) return "";
  const rangeStart = days[0];
  const rangeEnd = days[days.length - 1];
  return SEEDED_ASINS.map((asin) => {
    const seed = hashString(`${asin}:${mp}`);
    const amount = 500 + (seed % 5000) + (seed % 100) / 100;
    return JSON.stringify({
      parentAsin: asin,
      childAsin: asin,
      marketplaceId: mp,
      startDate: rangeStart,
      endDate: rangeEnd,
      sales: {
        orderedProductSales: { amount: Number(amount.toFixed(2)), currencyCode: "USD" },
        totalOrderItems: 1 + (seed % 50),
      },
      traffic: { browserPageViews: 10 + (seed % 400), unitSessionPercentage: seed % 100 },
    });
  }).join("\n");
}

// --- vendorSales (Vendor-only) generation ---

function vendorSalesByDate(q: ParsedQuery): string {
  const mp = marketplaceId(q);
  return bucketDates(datesInRange(q.startDate, q.endDate), q.aggregateBy)
    .map(({ startDate, endDate }) => {
      const seed = hashString(`vendor:${startDate}:${endDate}:${mp}`);
      const revenue = 5000 + (seed % 45000) + (seed % 100) / 100;
      return JSON.stringify({
        startDate,
        endDate,
        marketplaceId: mp,
        shippedRevenue: { amount: Number(revenue.toFixed(2)), currencyCode: "USD" },
        orderedUnits: 100 + (seed % 900),
        shippedUnits: 90 + (seed % 850),
      });
    })
    .join("\n");
}

export const DATASETS: Record<string, DatasetDefinition> = {
  analytics_salesAndTraffic_2024_04_24: {
    supportedModes: ["Seller"],
    // Represents both query-field schemas this dataset supports: byDate (2 lines)
    // and byAsin (one line per seeded ASIN).
    sample: [
      salesAndTrafficByDate({
        dataset: "analytics_salesAndTraffic_2024_04_24",
        queryField: "salesAndTrafficByDate",
        startDate: "2023-01-01",
        endDate: "2023-01-02",
        marketplaceIds: ["ATVPDKIKX0DER"],
        raw: "",
      }),
      salesAndTrafficByAsin({
        dataset: "analytics_salesAndTraffic_2024_04_24",
        queryField: "salesAndTrafficByAsin",
        startDate: "2023-01-01",
        endDate: "2023-01-02",
        marketplaceIds: ["ATVPDKIKX0DER"],
        raw: "",
      }),
    ].join("\n"),
    generate: (q) => (q.queryField === "salesAndTrafficByAsin" ? salesAndTrafficByAsin(q) : salesAndTrafficByDate(q)),
  },
  analytics_vendorSales: {
    supportedModes: ["Vendor"],
    sample: vendorSalesByDate({
      dataset: "analytics_vendorSales",
      queryField: "vendorSalesByDate",
      startDate: "2023-01-01",
      endDate: "2023-01-02",
      marketplaceIds: ["ATVPDKIKX0DER"],
      raw: "",
    }),
    generate: (q) => vendorSalesByDate(q),
  },
};

/**
 * Pure outcome classification, decided at createQuery time and stored on the
 * Query_Record so the eventual DONE/FATAL transition is timing-independent.
 * Assumes the dataset exists and is allowed for the current mode (validated earlier).
 */
export function classifyOutcome(q: ParsedQuery): Outcome {
  const def = DATASETS[q.dataset];
  if (def.alwaysFails || q.raw.includes(FATAL_MARKER)) return "FATAL";
  return def.generate(q).length > 0 ? "DATA" : "NO_DATA";
}
