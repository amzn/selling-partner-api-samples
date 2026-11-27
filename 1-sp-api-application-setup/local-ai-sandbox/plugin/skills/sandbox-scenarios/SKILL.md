---
name: sandbox-scenarios
description: This skill should be used when the user asks to "walk a scenario", "run a guided scenario", "seed a scenario", "launch a product in the sandbox", "get paid scenario", "show me the orders flow", or otherwise wants to explore an end-to-end SP-API journey in the local Sample AI Sandbox. Covers listing scenarios, seeding fixtures, executing a track's steps against the sandbox, and verifying the results.
version: 1.0.0
---

# Walking a guided sandbox scenario

A **scenario** is a pre-built, internally consistent set of fixtures (a "starting world") plus several **tracks** — branching journeys that explore different downstream paths from that same seed. `launch-a-product` seeds one product with listings, FBA inventory and two pending orders, then offers tracks for merchant-fulfilled orders, FBA orders, repricing, returns and FBA inbound.

Your job is to drive a track end to end against the running sandbox and show the user what actually happened, not to narrate the step list back to them.

## Before you start

The sandbox must be running on its port (default 9001). If any call below connects-refuses, stop and tell the user to start it with `npm run dev` rather than retrying.

## Process

1. **Get your bearings.** Call `get_sandbox_context` once. It gives you the base URL, the operating mode, the region, the resolved marketplace and currency, and `scenarioSellerId` — the seller that owns every scenario fixture. You need the base URL to turn a step's bare path into a real request.

2. **Pick the scenario and track.** Call `list_scenarios` for the index, then `get_scenario` for the one the user wants. Do not call `get_scenario` for all of them speculatively. If the user named a journey loosely ("show me returns"), map it to a track and say which one you picked.

3. **Seed the starting world.** Call `seed_scenario`. This writes the fixtures and is idempotent — re-seeding resets them to fixture state, which is the right move if a previous run mutated things. It deliberately does not fire data triggers.

4. **Execute the track's steps in order.** Each step carries `method`, `path`, `status`, a `note`, and sometimes a `body`. Send the runnable ones against the base URL. **Read `references/step-semantics.md` before the first step** — `status` decides whether a step is yours to run at all, and getting this wrong wastes the user's time on calls that cannot succeed.

   Paths arrive fully resolved: marketplace, currency and seller placeholders are already substituted. Send them as given. If you see `{{` in a path, that is a bug worth reporting, not something to fill in yourself.

5. **Verify, don't assume.** A 200 is not proof the world changed the way the step claimed. After any step that mutates state, confirm it independently — `references/verifying.md` has the specific checks per domain and the `get_data` fallback.

6. **Report what happened.** Per step: what you called, what came back that matters, and whether it matched the step's stated intent. Flag any step whose observed behaviour contradicted its `note` — that is a genuine finding about the sandbox, and more valuable than a clean-looking transcript.

## Rules

- **Never call `clear_data` as part of walking a scenario.** It wipes every namespace in the sandbox, including anything the user set up by hand. If a track seems to need a clean slate, re-seed the scenario instead; if you believe a full wipe is genuinely required, ask first.
- **Do not invent steps.** If a journey the user wants is not in any track, say so. The `planned` steps exist precisely to mark the gaps.
- **Do not fabricate identifiers.** Order ids, SKUs and ASINs come from the fixtures. If a step needs an id you do not have, read it back from the previous step's response.
