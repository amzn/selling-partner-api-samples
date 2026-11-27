# Why the stored shape differs from the API model

`get_api_model` returns the OpenAPI model for an API. That model describes the shape the API **responds with**. The sandbox stores documents in a shape that is sometimes different, and the handlers read from the stored shape.

So a record built purely from the model can insert successfully and then be invisible to every reader. `get_generation_guidance` exists to close that gap and is authoritative wherever the two disagree.

## The three ways they diverge

**1. Fields the handlers filter on that the model never declares.**

The clearest case is a `_type` discriminator. Both `finances` and `transfers` store three different record kinds in a single namespace, told apart by a required `_type` the readers filter on:

- `finances` → `"TRANSACTION"` | `"BALANCE"` | `"SUMMARY"`
- `transfers` → `"PAYOUT"` | `"EXPECTED_PAYOUT"` | `"PAYMENT_METHOD"`

An entity without the matching `_type` is invisible to every handler in that namespace. The model will never tell you this, because `_type` is not part of any API response.

**2. Nesting that must be exact.**

For listings, product data goes under `attributes`, never at the top level, in the instance form the product type definition specifies. Price is the usual trap — it nests as:

```
purchasable_offer: [{ marketplace_id, currency,
  our_price: [{ schedule: [{ value_with_tax }] }] }]
```

A flattened `our_price: [{ value }]` does not register as an offer at all. The listing stores fine and reads back as not buyable.

**3. System-managed fields.**

Some fields are the handlers' own bookkeeping — `mfnAvailability` on a listing is the live merchant-fulfilled stock ledger, and there are `createdDate` / `lastUpdatedDate` style fields elsewhere. Do not hand-author these. Let the handlers own them, or you will be asserting a state the sandbox is about to recompute.

## Fields that exist so filters work

Guidance often names fields that are not required for storage but _are_ required for the reader's filters to match. `listTransactions` filters on `postedDate`, `marketplaceDetails.marketplaceId`, `transactionStatus` and `relatedIdentifiers`; `listPayouts` orders and filters on `creationDate`.

Omit them and the record exists but never appears in a filtered query — which looks exactly like a generation failure. Populate anything the guidance calls out as filtered.

## Practical consequence

Read the guidance **before** building records, not after a read-back comes up empty. The order matters: by the time you are debugging an empty response, you have usually also written several records under keys you now need to find and fix.

And where guidance suggests concrete realistic values, prefer them over inventing your own — they are chosen to exercise the handlers' real paths.
