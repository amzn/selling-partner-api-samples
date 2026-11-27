# Step status, and what each one means for you

Every scenario step declares a `status`. It is not decoration — it tells you whether the call can succeed at all in this sandbox.

## `runnable`

The sandbox implements this operation. Send it against the base URL from `get_sandbox_context` and expect a real response.

These are the steps that carry the journey. If a `runnable` step fails, that is a real problem worth investigating and reporting — not something to shrug past.

## `pass-through`

The path is **proxied to production SP-API**, not served by the sandbox. It needs a valid LWA access token, which the sandbox does not mint for you.

Do not call these unless the user has said they have credentials configured and wants the live call made. Default behaviour: skip it, and tell the user in one line that the step is a live SP-API pass-through and why you skipped it. A `pass-through` step failing with an auth error is the expected outcome, not a finding.

In `launch-a-product`, the repricing track's `getCompetitiveSummary` is the example.

## `planned`

**Not implemented.** No handler is registered for this path. Calling it will not work, and the generic handler's response is not meaningful.

Skip it and say what it would have done. These steps document the intended journey past the edge of what the sandbox currently supports — the `returns` track in `launch-a-product` is entirely `planned`, and three of five `fba-inbound` steps are.

Do not try to work around a `planned` step by substituting a different API, generating the data by hand, or inserting records to fake the outcome. The gap is the information.

## Reading a step

```
method   GET | POST | PATCH | PUT | DELETE
path     already region-resolved; send as given
status   runnable | pass-through | planned
note     what the step demonstrates, and often what to look for in the response
body     present on write steps; send it as the JSON body
```

The `note` is written for a human reading the catalogue. Treat it as the step's _claim_ about what will happen, and check the response against it — a mismatch is the most useful thing you can surface.

## Placeholders

Paths and bodies reach you fully substituted: `{{MARKETPLACE_ID}}`, `{{CURRENCY}}` and `{{SELLER_ID}}` are resolved at load time from the configured region and the sandbox's canonical scenario seller.

So: send paths verbatim. If a `{{...}}` token survives into what you receive, the fixture declared a placeholder the loader does not substitute — report it rather than guessing a value.
