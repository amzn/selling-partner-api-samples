---
name: sandbox-test-data
description: This skill should be used when the user asks to create, generate or seed test data in the local Sample AI Sandbox for SP-API — for example "create three unshipped orders", "add some FBA inventory", "give me a listing with issues", "generate test data for finances", or "populate the sandbox". Covers choosing the API namespace, reading the stored-shape guidance, inserting records, and verifying they read back through the SP-API endpoints.
version: 1.0.0
---

# Generating sandbox test data

You generate the data yourself here, rather than asking the sandbox's own `/chat` generator to do it. The advantage is that you can verify your work: insert records, then call the SP-API endpoints and confirm the handlers return what you intended.

## Process

1. **Identify the namespace.** Call `list_apis` for the available `api` values, which have stored-shape guidance, and the sandbox's mode and region. If the request names an API the sandbox does not support, say so and stop — do not approximate it with a different namespace.

   If the request is not actually about test data, say so and stop.

2. **Read both shape sources.** For each target namespace, call `get_api_model` **and** `get_generation_guidance`.

   The API model describes the **API response** shape. The guidance describes the **stored document** shape. Where they differ, the guidance wins. Read `references/stored-vs-api-shape.md` for why they diverge and what that means for the records you build — getting this wrong produces records that insert cleanly and then read back as nothing.

   A namespace with no guidance means the model's shape is enough.

3. **Build the records.** Make them valid against the model and consistent with the guidance. Keep them internally coherent: a listing's SKU should match the inventory record's `sellerSku`, an order's `sellerSku` should name a listing that exists. Incoherent fixtures produce confusing results later.

4. **Get the keying right.** The `id` you pass must match the entity's own identifier, and some namespaces derive their key from fields _inside_ the entity. Listings need `sellerId` and `sku`; FBA inventory needs `sellerSku`. `references/keying-rules.md` has the full table and the failure mode for each.

5. **Insert with `insert_entities`.** Batch up to 100 per call. It returns a per-item result — read it. Fix and retry anything it reports as failed rather than moving on.

   Writes here **do** fire the sandbox's data triggers (unlike scenario seeding), so inserting an order may deduct inventory. That is usually what you want; just do not be surprised when a quantity you set has moved.

6. **Verify through the API.** Call the matching SP-API GET endpoint against the sandbox base URL from `get_sandbox_context` — `getOrders`, `getInventorySummaries`, `getListingsItem` — and confirm the handlers return your records. Use `get_data` to inspect raw stored documents when a read-back comes up empty and you need to tell "missing" apart from "stored under the wrong key".

7. **Report.** What you created (namespace and ids), and how you verified it. If a record would not read back, say that rather than reporting success.

## Rules

- **Never call `clear_data` unless the user explicitly asked to wipe the sandbox.** It deletes every namespace, not just the one you are working in. "Add some orders" is not a request to clear anything.
- **Do not invent values for fields the guidance calls system-managed.** Let the handlers populate them.
- **Prefer few, coherent records over many shallow ones** unless the user asked for volume. Three orders that tell a story beat thirty that do not.
