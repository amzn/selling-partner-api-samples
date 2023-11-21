import { Config } from "jest";
import nextJest from "next/jest";

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: "./",
});

// Add any custom config to be passed to Jest
const customJestConfig: Config = {
  testEnvironment: "jest-environment-jsdom",
  clearMocks: true,
  resetMocks: false,
  coverageReporters: ["cobertura", "html", "text"],
  coveragePathIgnorePatterns: ["/sdk/"],
  collectCoverage: true,
  testTimeout: 30000,
  coverageThreshold: {
    global: {
      lines: 85,
    },
  },
  moduleNameMapper: {
    // Force module uuid to resolve with the CJS entry point, because Jest does not support package.json.exports. See https://github.com/uuidjs/uuid/issues/451
    uuid: require.resolve("uuid"),
    "@/(.*)": "<rootDir>/$1",
  },
  setupFiles: ["./setupJest.js"],
};

export default createJestConfig(customJestConfig);
