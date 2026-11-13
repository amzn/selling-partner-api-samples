import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import fc from "fast-check";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { deriveNotificationType, filterSchemas } from "../../scripts/fetchNotificationSchemas.js";

describe("Feature: notification-schemas-fetch, Property 3: Filename-to-type derivation is a right-inverse", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any valid identifier string s, deriveNotificationType(s + ".json") === s.
   * This confirms that filename-to-type derivation is a right-inverse of type-to-filename.
   */
  it("deriveNotificationType(s + '.json') === s for any valid identifier", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[A-Za-z_][A-Za-z0-9_]*$/), (s) => {
        expect(deriveNotificationType(s + ".json")).toBe(s);
      }),
      { numRuns: 100 },
    );
  });

  it('concrete: deriveNotificationType("OrderChangeNotification.json") === "OrderChangeNotification"', () => {
    expect(deriveNotificationType("OrderChangeNotification.json")).toBe("OrderChangeNotification");
  });
});

describe("Feature: notification-schemas-fetch, Property 1: Allowlist filtering produces exact intersection", () => {
  /**
   * **Validates: Requirements 1.4, 3.1, 3.2, 4.1**
   *
   * For any set of upstream schema filenames and any allowlist,
   * the set of notification types in `toCopy` equals the intersection
   * of the allowlist entries and the set of derivable types from the upstream filenames.
   */
  it("toCopy keys equal the intersection of allowlist and available types", () => {
    // Use case-insensitive deduplication for filenames to avoid collisions on
    // case-insensitive filesystems (macOS HFS+/APFS).
    const caseInsensitiveSelector = (s: string) => s.toLowerCase();
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,29}$/), { minLength: 1, maxLength: 20, selector: caseInsensitiveSelector }),
        fc.uniqueArray(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,29}$/), { minLength: 0, maxLength: 15, selector: caseInsensitiveSelector }),
        (availableNames, extraAllowlistNames) => {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-schemas-test-"));
          try {
            // Write .json files for each available name
            for (const name of availableNames) {
              fs.writeFileSync(path.join(tempDir, `${name}.json`), "{}");
            }

            // Build allowlist: some entries from availableNames + some extras not in availableNames
            const availableSet = new Set(availableNames);
            const extrasNotInAvailable = extraAllowlistNames.filter((n) => !availableSet.has(n));
            const subsetOfAvailable = availableNames.slice(0, Math.ceil(availableNames.length / 2));
            const allowlist = [...subsetOfAvailable, ...extrasNotInAvailable];

            const { toCopy } = filterSchemas(tempDir, allowlist);

            // Expected intersection: allowlist entries that are also in availableNames
            const allowlistSet = new Set(allowlist);
            const expectedIntersection = new Set([...availableNames].filter((n) => allowlistSet.has(n)));

            expect(new Set(toCopy.keys())).toEqual(expectedIntersection);
          } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Feature: notification-schemas-fetch, Property 2: Missing allowlist entries are reported completely", () => {
  /**
   * **Validates: Requirements 1.5, 3.5, 6.4**
   *
   * For any allowlist and any set of upstream schema filenames,
   * the `missing` array contains exactly those allowlist entries
   * that have no corresponding file in the upstream directory.
   */
  it("missing equals allowlist entries not found in available types", () => {
    // Use case-insensitive deduplication for filenames to avoid collisions on
    // case-insensitive filesystems (macOS HFS+/APFS).
    const caseInsensitiveSelector = (s: string) => s.toLowerCase();
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,29}$/), { minLength: 1, maxLength: 20, selector: caseInsensitiveSelector }),
        fc.uniqueArray(fc.stringMatching(/^[A-Za-z][A-Za-z0-9]{0,29}$/), { minLength: 0, maxLength: 15, selector: caseInsensitiveSelector }),
        (availableNames, extraAllowlistNames) => {
          const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "filter-schemas-test-"));
          try {
            // Write .json files for each available name
            for (const name of availableNames) {
              fs.writeFileSync(path.join(tempDir, `${name}.json`), "{}");
            }

            // Build allowlist: some entries from availableNames + some extras not in availableNames
            const availableSet = new Set(availableNames);
            const extrasNotInAvailable = extraAllowlistNames.filter((n) => !availableSet.has(n));
            const subsetOfAvailable = availableNames.slice(0, Math.ceil(availableNames.length / 2));
            const allowlist = [...subsetOfAvailable, ...extrasNotInAvailable];

            const { missing } = filterSchemas(tempDir, allowlist);

            // Expected missing: allowlist entries NOT in available names
            const expectedMissing = allowlist.filter((entry) => !availableSet.has(entry)).sort();

            expect([...missing].sort()).toEqual(expectedMissing);
          } finally {
            fs.rmSync(tempDir, { recursive: true, force: true });
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("main() unit tests (mocked I/O)", () => {
  /**
   * **Validates: Requirements 1.2, 2.4, 4.4, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3**
   *
   * Tests the main() orchestration function with mocked filesystem and child_process
   * to verify logging, exit codes, and error handling behavior.
   */
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let processExitSpy: MockInstance;
  let originalArgv: string[];

  beforeEach(() => {
    vi.resetModules();
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    processExitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    originalArgv = process.argv;
    process.argv = ["node", "fetchNotificationSchemas.ts"];
  });

  afterEach(() => {
    process.argv = originalArgv;
    vi.restoreAllMocks();
  });

  it("logs warning and returns early when allowlist is empty", async () => {
    vi.doMock("../../scripts/config/notificationSchemasConfig.js", () => ({
      NOTIFICATION_SCHEMA_ALLOWLIST: [] as string[],
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn(),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      return { ...actual };
    });

    const { main } = await import("../../scripts/fetchNotificationSchemas.js");
    const { execFileSync: mockedExec } = await import("node:child_process");

    main();

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("[notifications:fetch]"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("No notification types configured"));
    // Should NOT attempt to clone
    expect(mockedExec).not.toHaveBeenCalled();
  });

  it("logs error and exits with code 1 when clone fails", async () => {
    // Use a sentinel error to simulate process.exit halting execution
    const exitError = new Error("__PROCESS_EXIT__");
    processExitSpy.mockImplementation(() => {
      throw exitError;
    });

    vi.doMock("../../scripts/config/notificationSchemasConfig.js", () => ({
      NOTIFICATION_SCHEMA_ALLOWLIST: ["OrderChangeNotification"],
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn().mockImplementation(() => {
        throw new Error("fatal: repository not found");
      }),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      return {
        ...actual,
        mkdtempSync: vi.fn().mockReturnValue("/tmp/sp-api-notification-schemas-test"),
      };
    });

    const { main } = await import("../../scripts/fetchNotificationSchemas.js");

    expect(() => {
      main();
    }).toThrow(exitError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("clone failed"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("fatal: repository not found"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  it("logs summary with correct counts on successful run", async () => {
    vi.doMock("../../scripts/config/notificationSchemasConfig.js", () => ({
      NOTIFICATION_SCHEMA_ALLOWLIST: ["OrderChangeNotification", "ListingsItemUpdate"],
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn().mockReturnValue(Buffer.from("")),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      return {
        ...actual,
        mkdtempSync: vi.fn().mockReturnValue("/tmp/sp-api-notification-schemas-test"),
        readdirSync: vi.fn().mockReturnValue(["OrderChangeNotification.json", "ListingsItemUpdate.json", "OtherNotification.json"]),
        mkdirSync: vi.fn(),
        copyFileSync: vi.fn(),
        rmSync: vi.fn(),
      };
    });

    const { main } = await import("../../scripts/fetchNotificationSchemas.js");
    const { rmSync: mockedRmSync } = await import("node:fs");
    main();

    // Verify summary line logged with correct counts
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("done"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("2 copied"));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining("0 missing"));
    expect(processExitSpy).not.toHaveBeenCalled();
    // Temp directory must be cleaned up after a successful run
    expect(mockedRmSync).toHaveBeenCalledWith("/tmp/sp-api-notification-schemas-test", { recursive: true, force: true });
  });

  it("logs error and exits with non-zero code when file write fails, and still cleans up the temp dir", async () => {
    vi.doMock("../../scripts/config/notificationSchemasConfig.js", () => ({
      NOTIFICATION_SCHEMA_ALLOWLIST: ["OrderChangeNotification"],
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn().mockReturnValue(Buffer.from("")),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      return {
        ...actual,
        mkdtempSync: vi.fn().mockReturnValue("/tmp/sp-api-notification-schemas-test"),
        readdirSync: vi.fn().mockReturnValue(["OrderChangeNotification.json"]),
        mkdirSync: vi.fn(),
        copyFileSync: vi.fn().mockImplementation(() => {
          throw new Error("EACCES: permission denied");
        }),
        rmSync: vi.fn(),
      };
    });

    const { main } = await import("../../scripts/fetchNotificationSchemas.js");
    const { rmSync: mockedRmSync } = await import("node:fs");
    main();

    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to write"));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("EACCES: permission denied"));
    expect(processExitSpy).toHaveBeenCalledWith(1);
    // Temp directory must still be cleaned up even though the run reported an error
    expect(mockedRmSync).toHaveBeenCalledWith("/tmp/sp-api-notification-schemas-test", { recursive: true, force: true });
  });

  it("cleans up the temp dir even when the clone fails", async () => {
    // main() creates the temp dir before cloning, so the finally block owns the
    // handle and must remove it regardless of where the clone fails — otherwise
    // the mkdtempSync directory would leak on every failed clone.
    const exitError = new Error("__PROCESS_EXIT__");
    processExitSpy.mockImplementation(() => {
      throw exitError;
    });

    vi.doMock("../../scripts/config/notificationSchemasConfig.js", () => ({
      NOTIFICATION_SCHEMA_ALLOWLIST: ["OrderChangeNotification"],
    }));
    vi.doMock("node:child_process", () => ({
      execFileSync: vi.fn().mockImplementation(() => {
        throw new Error("fatal: repository not found");
      }),
    }));
    vi.doMock("node:fs", async () => {
      const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
      return {
        ...actual,
        mkdtempSync: vi.fn().mockReturnValue("/tmp/sp-api-notification-schemas-test"),
        rmSync: vi.fn(),
      };
    });

    const { main } = await import("../../scripts/fetchNotificationSchemas.js");
    const { rmSync: mockedRmSync } = await import("node:fs");

    expect(() => {
      main();
    }).toThrow(exitError);

    // The temp dir must be cleaned up despite the clone failure.
    expect(mockedRmSync).toHaveBeenCalledWith("/tmp/sp-api-notification-schemas-test", { recursive: true, force: true });
  });
});
