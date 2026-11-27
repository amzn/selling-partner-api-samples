---
description: Walk a guided SP-API sandbox scenario end to end — seed it, run the track's steps, verify the results.
argument-hint: [scenario or track, e.g. "launch-a-product orders-mfn" or "returns"]
---

Walk a guided scenario in the local Sample AI Sandbox for SP-API.

Requested scenario/track: $ARGUMENTS

Follow the `sandbox-scenarios` skill for the full process. In short:

1. Call `get_sandbox_context` for the base URL, region and scenario seller.
2. Call `list_scenarios`; if the request above is empty or ambiguous, show the user the available scenarios and tracks and ask which one they want before going further.
3. Call `get_scenario` for the chosen scenario and `seed_scenario` to write the starting world.
4. Run the track's `runnable` steps in order against the base URL. Skip `planned` steps and say what they would have done; skip `pass-through` steps unless the user has confirmed they have live SP-API credentials and want the real call made.
5. Verify each mutating step by reading the change back through the SP-API endpoints, not by trusting the status code.
6. Report per step: what you called, what came back that matters, and whether it matched the step's stated intent. Call out any mismatch explicitly.

Do not call `clear_data`.
