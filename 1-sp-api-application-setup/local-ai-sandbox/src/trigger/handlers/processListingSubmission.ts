/**
 * Listings write trigger: runs catalog matching for the written listing.
 *
 * The matching logic itself lives in src/service/catalogMatching.ts, because
 * three callers share it — this trigger, the scheduled reconciliation job, and
 * the manual reprocess endpoint. A trigger fires only on listing writes, so it
 * cannot notice a catalog item that appears later; that is what the scheduled
 * sweep is for.
 */
import { DataEvent } from "../DataEvent.js";
import { reconcileListingMatching } from "../../service/catalogMatching.js";

/** Trigger handler: runs catalog matching for the written listing. */
export function processListingSubmission(event: DataEvent): void {
  reconcileListingMatching(event.id);
}
