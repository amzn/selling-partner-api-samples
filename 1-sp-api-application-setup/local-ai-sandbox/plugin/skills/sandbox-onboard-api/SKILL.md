---
name: sandbox-onboard-api
description: This skill should be used when the user wants to add a new SP-API to the local Sample AI Sandbox, or extend an existing one — for example "onboard the Fulfillment Inbound API", "add shipments to the sandbox", "wire up a new operation", "register a handler for X", "add a validation rule", or "add a trigger". Covers the model/registry pipeline, the Api enum, handler and validation registration, business logic, triggers, and verification.
version: 1.0.0
---

# Onboarding a new API into the sandbox

Adding an API is a seven-step pipeline, and the steps are ordered by dependency — the registry has to know about the model before the `Api` enum can match it, and the operation has to be registered before a validation pipeline can attach to it.

**The authoritative instructions are in `docs/onboarding-new-api.md` in the repo (372 lines, with the exact commands, file paths and code templates). Read it before starting.** This skill tells you how to approach the work and where the traps are; it does not duplicate the doc, and the doc wins wherever they differ.

## The shape of the work

1. **Model → registry.** Allowlist the upstream model folder, fetch and sanitize the model, add metadata overrides only if needed, exclude superseded versions or operations, then regenerate and verify. The registry under `res/generated/` is generated — never hand-edit it. Use the `registry:generate` / `registry:check` scripts.
2. **Make the `Api` enum match the registry.** There is a boot-time assertion for this; a mismatch fails fast rather than failing mysteriously later.
3. **Choose a behavior template and register the operation handler.**
4. **Register a validation pipeline.** Required for _every_ operation — not optional, even for a read.
5. **Add deterministic business logic.**
6. **Add side-effects as triggers** — declare the rule in `res/triggers.yaml`, then implement and register the handler.
7. **Verify.**

Work the steps in order and do not batch them. Each has its own verification, and a failure in step 4 is far easier to read when steps 1–3 are already known good.

## How to approach it

- **Follow the existing patterns rather than inventing.** Each concern has an established registry — operations, validation rules, triggers, generation guidance. Find the closest already-onboarded API and mirror how it does things. The repo is consistent on purpose, and a new API that does things its own way is the main source of drift.
- **Run the build gates as you go**, not at the end: `npm run type-check`, `npm run registry:check`, and `npx vitest run`. The test suite is large and fast.
- **Add tests in `test/`, mirroring the `src/` path.** An onboarded API with no tests is not finished — look at how a comparable API's tests are structured and match them.
- **If the stored document shape will differ from the API model**, add a generation-guidance entry (see `src/tool/domainGuidance.ts`). This is easy to forget because nothing fails at boot when it is missing — it surfaces later as generated records the handlers cannot read back. Decide deliberately whether the namespace needs one.

## Rules

- **Never hand-edit generated files.** Regenerate them. If the generated output is wrong, the fix belongs in the generator config or the metadata overrides.
- **Do not skip the validation pipeline** because an operation looks trivial. Every operation gets one.
- **Do not commit** unless the user asks.
- Report the build/test results honestly, including anything still failing. Half-onboarded is a normal intermediate state; silently-broken is not.
