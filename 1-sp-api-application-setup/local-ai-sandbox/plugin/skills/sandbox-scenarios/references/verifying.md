# Verifying that a step actually changed the world

A 2xx means the handler accepted the request. It does not mean the state changed the way the step's `note` claimed. Verify mutations independently.

## Prefer the SP-API endpoints over `get_data`

Read the change back through the **same API surface a real integration would use** — `getOrder` after `confirmShipment`, `getInventorySummaries` after an order, `getListingsItem` after a patch. That exercises the handler's own read path, which is the thing worth testing.

Use `get_data` as a fallback when a read endpoint does not exist, when you need to see the raw stored document, or when a read-back returns empty and you need to find out whether the record is missing or merely unreachable.

That distinction matters: a record stored under the wrong key reads back as _empty_, not as an error. `get_data` tells the two apart.

## Storage keys, when you do look at raw data

`get_data` is keyed by API namespace, then by storage key. The keys are derived, not always the obvious field:

| Namespace   | Storage key                                       |
| ----------- | ------------------------------------------------- |
| `listings`  | `sellerId\|sku` — composite, **not** the bare SKU |
| `inventory` | `sellerSku` alone                                 |
| `orders`    | `orderId`                                         |
| `catalog`   | `asin`                                            |

So a seeded listing for SKU `LAUNCH-SKU-001` appears under `<scenarioSellerId>|LAUNCH-SKU-001`. Looking for the bare SKU and finding nothing is not evidence the seed failed.

## Data triggers run detached

Some writes fire declarative triggers — confirming a shipment creates a package entry, placing an order can deduct FBA inventory, submitting a listing runs processing.

**These run detached from the write.** The response returns before they finish. If you read back immediately and the triggered effect is missing, that is timing, not necessarily a bug. Re-read once before concluding anything.

Scenario _seeding_ is different: it writes a consistent snapshot and is not meant to fire triggers at all, because re-applying them would double-count the fixtures.

## What to report

For each mutating step, state the before and after of the specific field that was supposed to change:

> `confirmShipment` → 200. `getOrder` now reports `fulfillmentStatus: SHIPPED` (was `UNSHIPPED`) and one package with tracking. Matches the step's note.

And when it does not match, say so plainly with both values. A step whose observed behaviour contradicts its `note` is the most useful output of the whole walk — surface it rather than smoothing over it.
