import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      MODE: "Seller",
      TZ: "UTC",
      // A sweep firing mid-suite would mutate the database under a running
      // test. Tests that need one call runMatchingSweep() directly.
      MATCHING_INTERVAL_MS: "0",
    },
  },
});
