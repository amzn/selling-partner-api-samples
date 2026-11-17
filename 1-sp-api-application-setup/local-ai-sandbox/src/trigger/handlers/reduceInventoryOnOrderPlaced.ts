import { DataEvent } from "../DataEvent.js";
import { Api, Context } from "../../database/Context.js";

/**
 * When a new order is placed with status PENDING, reduce inventory
 * for each order item's SKU by the quantity ordered.
 *
 * Channel logic:
 *   - fulfilledBy "MERCHANT" → reduce listing's fulfillment_availability (channel DEFAULT)
 *   - fulfilledBy "AMAZON"   → reduce FBA inventory in the inventory partition
 */
export function reduceInventoryOnOrderPlaced(event: DataEvent): void {
  const order = event.entity;
  const orderItems = order?.orderItems ?? [];
  const fulfilledBy = order?.fulfillment?.fulfilledBy;

  for (const item of orderItems) {
    const sku = item.product?.sellerSku;
    const quantity = item.quantityOrdered ?? 0;

    if (!sku || quantity <= 0) continue;

    if (fulfilledBy === "MERCHANT") {
      reduceMfnInventory(sku, quantity);
    } else {
      reduceFbaInventory(sku, quantity);
    }
  }
}

/**
 * Resolves the listing an order line refers to. Listings are keyed by seller
 * and SKU, but an order carries no selling partner, so the SKU is matched on
 * its own. When several sellers use the same SKU the line cannot be
 * attributed to one of them, and guessing would deduct from the wrong
 * seller's ledger — so nothing is reduced.
 */
function findListingBySku(sku: string): Record<string, unknown> | undefined {
  const matches = Context.instance.engine.find(Api.LISTINGS, { sku });
  if (matches.length === 1) return matches[0];

  if (matches.length > 1) {
    console.warn(`[Trigger] SKU ${sku} belongs to ${String(matches.length)} sellers; the order does not say which, so MFN inventory is unchanged`);
  }
  return undefined;
}

function reduceMfnInventory(sku: string, quantity: number): void {
  const engine = Context.instance.engine;
  const listing = findListingBySku(sku);
  if (!listing) return;

  // Live MFN quantities are kept in the listing's mfnAvailability ledger
  // (system-managed). The attributes layer is never touched: the seller's
  // submitted fulfillment_availability keeps showing the submitted value
  // while the ledger reflects live inventory.
  const ledger = listing.mfnAvailability as { fulfillmentChannelCode?: string; quantity?: number }[] | undefined;
  if (!Array.isArray(ledger)) return;

  const mfnChannel = ledger.find((entry) => entry.fulfillmentChannelCode === "DEFAULT");

  if (mfnChannel?.quantity !== undefined) {
    mfnChannel.quantity = Math.max(0, mfnChannel.quantity - quantity);
    // Written back under the listing's own composite key, never a bare SKU.
    engine.put(Api.LISTINGS, String(listing._key), listing, { silent: true });
    console.info(`[Trigger] Reduced MFN inventory for SKU ${sku} by ${String(quantity)} (channel DEFAULT)`);
  }
}

function reduceFbaInventory(sku: string, quantity: number): void {
  const engine = Context.instance.engine;
  const inventoryEntry = engine.get(Api.INVENTORY, sku);
  if (!inventoryEntry) return;

  if (inventoryEntry.totalQuantity !== undefined) {
    inventoryEntry.totalQuantity = Math.max(0, (inventoryEntry.totalQuantity as number) - quantity);
  }
  if (inventoryEntry.fulfillableQuantity !== undefined) {
    inventoryEntry.fulfillableQuantity = Math.max(0, (inventoryEntry.fulfillableQuantity as number) - quantity);
  }

  engine.put(Api.INVENTORY, sku, inventoryEntry, { silent: true });
  console.info(`[Trigger] Reduced FBA inventory for SKU ${sku} by ${quantity}`);
}
