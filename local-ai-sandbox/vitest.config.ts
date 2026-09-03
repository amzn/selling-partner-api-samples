import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    env: {
      MODE: "Seller",
      TZ: "UTC",
    },
  },
});
