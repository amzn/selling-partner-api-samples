# Keying rules for `insert_entities`

Every record is stored under a key. For most namespaces that key is the `id` you pass. For two of them it is **derived from fields inside the entity**, and if those fields are missing the insert is rejected — or worse, succeeds under a key no reader looks at.

## The table

| Namespace       | Key                         | What the entity must carry                        |
| --------------- | --------------------------- | ------------------------------------------------- |
| `listings`      | `sellerId\|sku` (composite) | **both** `sellerId` and `sku`                     |
| `inventory`     | `sellerSku` alone           | `sellerSku`                                       |
| everything else | the `id` you pass           | `id` must match the entity's own identifier field |

## Listings: both fields, always

A SKU is only unique _per seller_, so the key is built from `sellerId` and `sku` together. Pass both inside the entity.

`insert_entities` rejects a listing with no `sellerId` and tells you so — fix it and retry rather than falling back to a bare SKU as the id. Use the seller id the user gave, or a realistic one.

The consequence of getting this wrong, if it ever slips past: `getListingsItem` resolves `sellerId|sku` and finds nothing, and `searchListingsItems` filters on the `sellerId` field and matches nothing. The record is in the database and unreachable through every API path.

## FBA inventory: the bare SKU, and nothing else

`getInventorySummaries` filters on the `sellerSku` field, while listing availability and the order-placed trigger look the record up **by key**. Both have to agree, so the key is the bare `sellerSku` — not a composite, not prefixed.

## Everything else: `id` must match the entity

Pass an `id` that equals the entity's own identifier:

- `orders` → `orderId`
- `catalog` → `asin`
- `finances` transactions → `transactionId`
- `transfers` payouts → `id`

A mismatch between the `id` argument and the field inside the document means the record is keyed one way and self-describes another. Readers that look up by key and readers that filter on the field will disagree about whether it exists.

## Catalog is a special case: do not write it directly

For listings, include `asin` — the seller's `merchant_suggested_asin` when given, otherwise a plausible new one (`B0` plus 8 uppercase alphanumerics). The sandbox creates the matching catalog item from it.

So do not write to the `catalog` namespace yourself when creating listings. Let the listing drive it, or you will end up with two catalog records disagreeing about the same ASIN.

## Checking your work

`insert_entities` returns a per-item result with the resolved key. Read it. If a key does not look like what this table predicts, stop and work out why before inserting more records on the same assumption.
