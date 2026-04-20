export default {
  preset: "ts-jest",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: {
          "module": "ES2020",
          "moduleResolution": "node",
          "esModuleInterop": true,
        },
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts"],
};
