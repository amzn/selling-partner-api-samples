import { Api } from "../database/Context.js";
import { DataEvent, DataEventType } from "./DataEvent.js";
import { triggerRegistry } from "./triggerRegistry.js";

export class TriggerProcessor {
  /**
   * Emit a data event and fire any matching triggers.
   * Call this after any successful database write operation.
   */
  static async emit(type: DataEventType, api: Api, id: string, entity?: any, previousEntity?: any): Promise<void> {
    const event: DataEvent = { type, api, id, entity, previousEntity };
    await this.process(event);
  }

  private static async process(event: DataEvent): Promise<void> {
    const triggers = triggerRegistry.filter(
      (trigger) => trigger.on.api === event.api && trigger.on.event.includes(event.type),
    );

    for (const trigger of triggers) {
      try {
        if (trigger.on.condition && !trigger.on.condition(event)) {
          continue;
        }
        console.info(`[Trigger] Executing: ${trigger.name}`);
        await trigger.handler(event);
      } catch (error) {
        console.error(`[Trigger] Failed: ${trigger.name}`, error);
      }
    }
  }
}
