import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { JSONPath } from "jsonpath-plus";
import { Api } from "../database/Context.js";
import { DataEvent, DataEventType } from "./DataEvent.js";
import { reduceInventoryOnOrderPlaced } from "./handlers/reduceInventoryOnOrderPlaced.js";
import { processListingSubmission } from "./handlers/processListingSubmission.js";
import { sendOrderChangeNotification } from "./handlers/sendOrderChangeNotification.js";

export interface Trigger {
  name: string;
  description: string;
  on: {
    api: Api;
    event: DataEventType[];
    condition?: (event: DataEvent) => boolean;
  };
  handler: (event: DataEvent) => void | Promise<void>;
}

/**
 * Handler map: resolves handler names from the YAML spec to actual functions.
 * Add new handlers here when creating new triggers.
 */
const handlers: Record<string, (event: DataEvent) => void | Promise<void>> = {
  reduceInventoryOnOrderPlaced,
  processListingSubmission,
  sendOrderChangeNotification,
};

/**
 * Condition parser using JSONPath.
 * 
 * Condition format in YAML:
 *   condition:
 *     path: "$.fulfillment.fulfillmentStatus"   # JSONPath expression
 *     equals: "SHIPPED"                          # Expected value (supports: equals, notEquals, exists)
 *
 * Supports:
 *   - equals: value at path must equal the given value
 *   - notEquals: value at path must not equal the given value
 *   - exists: true/false — whether the path resolves to a value
 */
function parseCondition(condition: any): ((event: DataEvent) => boolean) | undefined {
  if (!condition) return undefined;

  const { path, equals, notEquals, exists } = condition;
  if (!path) return undefined;

  return (event: DataEvent) => {
    const target = event.type === "DELETE" ? event.previousEntity : event.entity;
    const results = JSONPath({ path, json: target ?? {} });
    const value = results.length > 0 ? results[0] : undefined;

    if (equals !== undefined) return value === equals;
    if (notEquals !== undefined) return value !== notEquals;
    if (exists === true) return value != null;
    if (exists === false) return value == null;

    return results.length > 0;
  };
}

/**
 * Load trigger rules from the YAML spec file.
 */
function loadTriggers(): Trigger[] {
  const content = readFileSync("./res/triggers.yaml", "utf-8");
  const spec = parse(content);
  const triggers: Trigger[] = [];

  for (const [, items] of Object.entries(spec.domains) as [string, any][]) {
    for (const trigger of items) {
      const handler = handlers[trigger.handler];
      if (!handler) {
        console.error(`[Trigger] Unknown handler: ${trigger.handler}`);
        continue;
      }
      triggers.push({
        name: trigger.name,
        description: trigger.description,
        on: {
          api: trigger.on.api as Api,
          event: trigger.on.event as DataEventType[],
          condition: parseCondition(trigger.on.condition),
        },
        handler,
      });
    }
  }

  return triggers;
}

export const triggerRegistry: Trigger[] = loadTriggers();
