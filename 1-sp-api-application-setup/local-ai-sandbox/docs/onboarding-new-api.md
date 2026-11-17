# Onboarding a New API

This guide walks through every step required to add a new SP-API endpoint (or a whole new API
domain) to the Sample AI Sandbox. It reflects the current, registry-driven architecture: a single
generated **operation registry** is the source of truth for routing/validation facts, and each
operation is wired up through a small set of registries and (optionally) a behavior template.

> **Mental model.** Adding an API is mostly *data + registration*, not plumbing. You (1) bring the
> OpenAPI model into the repo and regenerate the registry, (2) make the `Api` enum match, (3) pick a
> **behavior template** per operation and register a handler, (4) register a validation pipeline
> (required for every operation — use `[]` when there are no business rules), then optionally
> (5) add deterministic business logic and (6) add side-effects (triggers).

## Request lifecycle (what happens at runtime)

Understanding the flow makes each onboarding step obvious. Every unmatched route funnels into
`spapiController.createResponse` (`src/index.ts` → `app.all("/{*splat}", ...)`):

1. **Schema stage** — `validationEngine.validateRequest` uses `identifyApiModel(path)` (from the
   operation registry) to find the model file, then validates the request with `openapi-enforcer`.
   It extracts `operationId`, `apiName`, and `apiVersion`.
2. **Pipeline stage** — the composite key `apiName:apiVersion:operationId` is looked up in
   `VALIDATION_REGISTRY`. Its ordered `ValidationPipeline` runs; the first failing rule
   short-circuits with an error response. Entities resolved here are passed downstream.
   **If no pipeline is registered for the key, the request fails with a `NoValidationPipeline`
   error before any handler runs** — every operation needs an entry, even an empty one.
3. **Operation handler** — the same composite key is looked up in `OPERATIONS_REGISTRY`
   (`src/registry/operationRegistry.ts`). The handler runs deterministic logic and returns an
   `OperationContext`. If no handler is registered, the controller returns **501**.
4. **Response behavior** — The controller sends `data.body` (and optional `data.headers`) directly.

## Key files

| Concern | File |
|---------|------|
| Registration policy (allowlist, overrides, exclude list) | `scripts/config/apiRegistrationConfig.ts` |
| Copy + sanitize upstream models | `scripts/fetchModels.ts` |
| Generate the operation registry | `scripts/generateOperationRegistry.ts` |
| Generated registry (checked in) | `res/generated/operationRegistry.json` |
| Local OpenAPI specs | `res/models/*.json` |
| DB partitions (`Api` enum) | `src/database/Context.ts` |
| Operation handlers + behavior template registration | `src/registry/operationRegistry.ts`, `src/operation/*` |
| Validation pipelines | `src/validation/validationRegistry.ts`, `src/validation/validationTypes.ts` |
| Triggers (side-effects) | `res/triggers.yaml`, `src/trigger/*` |

---

## Step 1 — Bring the model in and regenerate the registry

All registration policy lives in `scripts/config/apiRegistrationConfig.ts`. The two scripts
(`fetchModels.ts`, `generateOperationRegistry.ts`) consume it.

### 1a. Allowlist the upstream model folder

`fetchModels.ts` does a sparse clone of [`amzn/selling-partner-api-models`](https://github.com/amzn/selling-partner-api-models)
and only copies folders named in `ALLOWLIST`. Add your API's upstream `models/` folder name:

```ts
// scripts/config/apiRegistrationConfig.ts
export const ALLOWLIST: string[] = [
  // ...existing entries...
  "my-new-api-model", // <- upstream folder under models/ in amzn/selling-partner-api-models
];
```

> An **empty** `ALLOWLIST` means "import everything (minus the exclude list)". Until coverage
> approaches full parity, keep the allowlist explicit so we don't import surface we can't handle yet.

### 1b. Fetch + sanitize the model

```bash
npm run models:fetch            # copies from upstream `main`
# or pin a ref for reproducibility:
tsx scripts/fetchModels.ts --ref v<tag-or-commit>
```

`fetchModels.ts` writes sanitized JSON into `res/models/`. Sanitization recursively strips every
`examples` block and `x-amzn-api-sandbox` key (the singular `example` is preserved).

### 1c. Add metadata overrides *only if needed*

The generator derives facts from each model automatically:

- **`apiVersion`** ← `info.version` (e.g. `v0`, `2021-06-30`, `v1`).
- **`apiName`** ← `info.title` with SP-API boilerplate stripped (`deriveApiName`).
- **`dbNamespace`** ← lowerCamel slug of `apiName` (`deriveDbNamespace`).
- **`pathPrefix`** ← longest common static path prefix (used for longest-prefix routing).

Add an entry to `API_METADATA_OVERRIDES` **only** when a derived value would be wrong:

```ts
export const API_METADATA_OVERRIDES: Record<string, ApiMetadataOverride> = {
  // ...
  "myNewApi_2025-01-01.json": {
    apiName: "My New API",     // if the title doesn't slugify to the canonical name
    dbNamespace: "myNewApi",   // must equal a member of the `Api` enum (Step 2)
    // resourcePath: "./res/..." // only if the resource-retrieval tool needs a non-model file
  },
};
```

> **`apiName` must match the validation registry.** Whatever `apiName` ends up in the registry is
> the first segment of the composite key `apiName:apiVersion:operationId` used everywhere.

### 1d. Exclude superseded versions or specific operations

```ts
export const EXCLUDE_LIST: ExcludeListEntry[] = [
  // whole model/API:
  { apiName: "My New API", apiVersion: "v0", reason: "Superseded by 2025-01-01." },
  // or only specific operations (rest of the model is still registered):
  { modelFile: "myNewApi_2025-01-01.json", operationIds: ["unsupportedOp"], reason: "Not implemented." },
];
```

Operations flagged `deprecated: true` in the schema are dropped automatically — no entry needed.

### 1e. Regenerate and verify

```bash
npm run registry:generate   # rewrites res/generated/operationRegistry.json
# or do 1b + 1e together:
npm run models:sync
```

The registry is **checked in**. `npm run registry:check` fails (exit 1) if the committed file is
stale — run it before pushing. Commit the regenerated `res/generated/operationRegistry.json`
alongside your config change.

---

## Step 2 — Make the `Api` enum match the registry

Every non-excluded model contributes a `dbNamespace` to the registry — **including pass-through
APIs** (e.g. `listingsRestrictions`, `productTypeDefinitions`). The database `Api` enum in
`src/database/Context.ts` must exactly equal the set of registry namespaces, or the app throws at
startup (`assertEnumMatchesRegistry`).

```ts
// src/database/Context.ts
export enum Api {
  // ...existing...
  MY_NEW_API = "myNewApi", // value MUST equal the dbNamespace from Step 1
}
```

If you skip this, boot fails fast with a message telling you exactly which namespace is missing from
which side. This is intentional — one guarded edit instead of silent drift.

---

## Step 3 — Choose a behavior template and register the operation handler

Every operation needs a handler registered in `OPERATIONS_REGISTRY.registerAllHandlers()`
(`src/registry/operationRegistry.ts`). Pick the **behavior template** that fits the operation:

| Template | When to use | Handler |
|----------|-------------|---------|
| **Pass-through** | The sandbox should proxy to the real SP-API (prod or sandbox backend) | `productionPassThroughHandler` / `sandboxPassThroughHandler` (`src/operation/passThroughOperations.ts`) |
| **Local (deterministic)** | Fully local, deterministic response you build yourself (e.g. Reports) | Your handler in `src/operation/<domain>Operations.ts` |

Register with `buildKey`-style arguments:

```ts
// src/registry/operationRegistry.ts  → registerAllHandlers()
this.register("My New API", "2025-01-01", "getThing", getThingHandler);          // local
this.register("My New API", "2025-01-01", "getRemoteThing", productionPassThroughHandler); // pass-through
```

- Composite key = `"My New API:2025-01-01:getThing"`. If no handler is registered under it,
  `spapiController` returns a bare **501**. Keep `apiName`/`apiVersion`/`operationId` identical to
  the generated-registry entry — a mismatch means your handler is registered under a key that no
  incoming request will ever produce.

### Behavior details

- **Local**: return `data.body` (JSON) and optional `data.headers`. The controller sends them at
  `OperationContext.statusCode` verbatim — no AI, no network.
- **Pass-through**: no code to write. The generic handler forwards the method, path, raw query
  string, request body (for non-GET/HEAD/DELETE), and the `content-type`, `x-amz-access-token`, and
  `user-agent` headers to `https://sellingpartnerapi-<region>.amazon.com` (production) or
  `https://sandbox.sellingpartnerapi-<region>.amazon.com` (sandbox), where `<region>` is the
  lowercased `REGION` env var (`na`/`eu`/`fe`).

---

## Step 4 — Register a validation pipeline (required for every operation)

Schema validation (types, required fields, enums) is automatic via `openapi-enforcer` against your
model. Business-rule validation runs afterwards through a `ValidationPipeline` registered under the
composite key in `VALIDATION_REGISTRY` (`src/validation/validationRegistry.ts`).

**Every operation must have an entry** — the validation engine rejects requests whose key has no
pipeline (`NoValidationPipeline`) before the handler runs. If an operation has no business rules,
register an empty pipeline, as existing ops do:

```ts
["My New API:2025-01-01:listThings", []], // no business rules — schema validation only
```

For operations with business rules, list them in order:

```ts
export const VALIDATION_REGISTRY = new Map<string, ValidationPipeline>([
  // ...
  ["My New API:2025-01-01:getThing", [
    {
      checkType: "entityExistence",
      entity: { api: Api.MY_NEW_API, paramName: "thingId", paramSource: "path", entityLabel: "thing" },
      failAction: { statusCode: 404, code: "NotFound", message: "Thing not found" },
    },
    {
      checkType: "marketplaceIdValidation",
      marketplaceIdsParam: { name: "marketplaceIds", source: "query" },
      failAction: { statusCode: 400, code: "InvalidInput", message: "Invalid marketplace ID" },
    },
  ]],
]);
```

Rules run in order; the first failure returns its `failAction`. Entities resolved by
`entityExistence` are accumulated and delivered to your operation handler as
`validationResult.resolvedEntities[entityLabel]`.

### Available rule types

`entityExistence`, `mutualExclusivity`, `atLeastOneRequired`, `conditionalExclusion`,
`businessRule`, `dateComparison`, `orderItemExistence`, `quantityLimit`, `reportTypeSupported`,
`reportMetaValidation`, `entityFieldCheck`, `reportSchedulable`, `marketplaceIdValidation`.

See `src/validation/validationTypes.ts` for the exact shape of each (and its Zod schema). Reuse
these before inventing new ones.

### Adding a brand-new rule type

If no existing rule fits:

1. Add the rule interface + its Zod schema in `src/validation/validationTypes.ts`, and add it to the
   `ValidationRule` union and `ValidationRuleSchema` discriminated union.
2. Register a handler for the new `checkType` in `src/service/validationEngine.ts` so the engine
   knows how to execute it.

---

## Step 5 — Add deterministic business logic

Implement local/AI handlers in `src/operation/<domain>Operations.ts`. A handler is an
`OperationHandler`: `(validationResult, request) => Promise<OperationContext>`.

```ts
// src/operation/myNewApiOperations.ts
import { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";

export const getThingHandler: OperationHandler = async (validationResult) => {
  const thingId = validationResult.pathParams.thingId;
  const thing = Context.instance.engine.get(Api.MY_NEW_API, thingId);

  return {
    statusCode: thing ? 200 : 404,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    // Local template → data.body is sent verbatim.
    data: thing ? { body: thing } : { error: "Thing not found", thingId },
  };
};
```

Database access goes through `Context.instance.engine` (LokiJS wrapper): `get`, `find` (LokiJS
query syntax), `put` (upsert), `remove`, `getBatch`. Data is partitioned by the `Api` enum member.
Prefer reusing entities already resolved during validation (`validationResult.resolvedEntities`)
instead of re-reading them.

Remember to register the handler (Step 3).

---

## Step 6 — Add side-effects (triggers)

Triggers are deterministic, cross-cutting reactions to database writes (e.g. reduce inventory when
an order is placed). They are declared in `res/triggers.yaml` and implemented as pure handler
functions.

### 6a. Declare the rule

```yaml
# res/triggers.yaml
domains:
  myNewApi:
    - name: Do something on thing created
      description: >
        When a thing is created, update the related record.
      on:
        api: myNewApi          # must equal the Api enum value
        event: [INSERT]        # INSERT | UPDATE | DELETE
        condition:             # optional; JSONPath against the entity
          path: "$.status"
          equals: "ACTIVE"     # supports equals | notEquals | exists
      handler: doSomethingOnThingCreated
```

### 6b. Implement + register the handler

```ts
// src/trigger/handlers/doSomethingOnThingCreated.ts
import { DataEvent } from "../DataEvent.js";
export function doSomethingOnThingCreated(event: DataEvent): void {
  const thing = event.entity;
  // ...deterministic side-effect using Context.instance.engine...
}
```

```ts
// src/trigger/triggerRegistry.ts → handlers map
const handlers: Record<string, (event: DataEvent) => void | Promise<void>> = {
  reduceInventoryOnOrderPlaced,
  doSomethingOnThingCreated, // <- add here
};
```

### How/when triggers fire

A trigger runs only when a `DataEvent` is **emitted** for its `api` + `event` (and its optional
condition passes):

- `DatabaseEngine.put()` emits `INSERT` or `UPDATE`, deciding from whether the key already existed.
- `DatabaseEngine.remove()` emits `DELETE`, with the previous entity attached.
- Emission lives in the engine, so **every** write path fires triggers — operation handlers, the
  data-generator's `databaseInsertionTool`, and any future caller alike. No handler calls
  `TriggerProcessor.emit(...)` itself.
- Emission is deferred one tick, so the originating write returns before any handler runs.
- **A trigger handler that writes must pass `{ silent: true }`.** A silent write emits nothing, and
  is the only mechanism preventing a handler from re-entering the trigger chain.

---

## Step 7 — Verify

```bash
npm run registry:check   # generated registry is fresh & committed
npm run type-check       # types (incl. Api enum ↔ registry usage)
npm run lint
npm run test:run         # unit + property tests
npm run build            # tsc production build
npm run dev              # boot: registry validate() + enum assertion + handler wiring
```

At boot the app calls `validateOperationRegistry()` (non-empty, no duplicate composite keys) and
`assertEnumMatchesRegistry()`. A green boot means your registration is internally consistent.

Add tests mirroring `src/` under `test/` (e.g. `test/operation/`, `test/validation/`) — property
tests via `fast-check` are used heavily for validation and registry invariants.

---

## Quick checklist

- [ ] `ALLOWLIST` updated; `npm run models:fetch` copied the model into `res/models/`.
- [ ] `API_METADATA_OVERRIDES` / `EXCLUDE_LIST` adjusted only where derivation is wrong.
- [ ] `npm run registry:generate` run; `res/generated/operationRegistry.json` committed.
- [ ] `Api` enum member added matching the new `dbNamespace`.
- [ ] Behavior template chosen and handler registered in `registerAllHandlers()`.
- [ ] Validation pipeline registered under the composite key for **every** operation (`[]` if no business rules).
- [ ] Deterministic handler implemented in `src/operation/` (local/AI templates).
- [ ] Triggers declared in `res/triggers.yaml` + handler registered (if there are side-effects).
- [ ] `registry:check`, `type-check`, `lint`, `test:run`, `build` all green; app boots.
