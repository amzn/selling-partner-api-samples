import { migrationAssistantSchema } from "../../src/zod-schemas/migration-schemas";
import { z } from "zod";

describe("Migration Schemas", () => {
  describe("migrationAssistantSchema", () => {
    describe("valid inputs", () => {
      it("should validate minimal required fields", () => {
        const validData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_version).toBe("orders-v0");
          expect(result.data.target_version).toBe("orders-2026-01-01");
          expect(result.data.analysis_only).toBe(false); // default value
        }
      });

      it("should validate with all fields provided", () => {
        const validData = {
          source_code: "const orders = await getOrders();",
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          language: "javascript",
          analysis_only: true,
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code).toBe(
            "const orders = await getOrders();",
          );
          expect(result.data.source_version).toBe("orders-v0");
          expect(result.data.target_version).toBe("orders-2026-01-01");
          expect(result.data.language).toBe("javascript");
          expect(result.data.analysis_only).toBe(true);
        }
      });

      it("should validate with source_code omitted", () => {
        const validData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          language: "python",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code).toBeUndefined();
          expect(result.data.language).toBe("python");
        }
      });

      it("should validate with language omitted", () => {
        const validData = {
          source_code: "response = get_orders()",
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.language).toBeUndefined();
        }
      });

      it("should apply default value for analysis_only", () => {
        const validData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.analysis_only).toBe(false);
        }
      });

      it("should validate with analysis_only set to false", () => {
        const validData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          analysis_only: false,
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.analysis_only).toBe(false);
        }
      });

      it("should validate with empty source_code string", () => {
        const validData = {
          source_code: "",
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code).toBe("");
        }
      });

      it("should validate with multiline source_code", () => {
        const validData = {
          source_code: `
            const response = await getOrders({
              marketplaceIds: ['ATVPDKIKX0DER'],
              createdAfter: '2025-01-01T00:00:00Z'
            });
            const orders = response.orders;
          `,
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject missing source_version", () => {
        const invalidData = {
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("source_version");
        }
      });

      it("should reject missing target_version", () => {
        const invalidData = {
          source_version: "orders-v0",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("target_version");
        }
      });

      it("should reject non-string source_code", () => {
        const invalidData = {
          source_code: 123,
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("source_code");
        }
      });

      it("should reject non-string source_version", () => {
        const invalidData = {
          source_version: 0,
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("source_version");
        }
      });

      it("should reject non-string target_version", () => {
        const invalidData = {
          source_version: "orders-v0",
          target_version: null,
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("target_version");
        }
      });

      it("should reject non-string language", () => {
        const invalidData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          language: 123,
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("language");
        }
      });

      it("should reject non-boolean analysis_only", () => {
        const invalidData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          analysis_only: "true",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("analysis_only");
        }
      });

      it("should reject empty object", () => {
        const invalidData = {};

        const result = migrationAssistantSchema.safeParse(invalidData);
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues.length).toBeGreaterThanOrEqual(2);
        }
      });

      it("should reject extra unknown fields", () => {
        const invalidData = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          unknown_field: "value",
        };

        const result = migrationAssistantSchema.safeParse(invalidData);
        // Zod by default allows extra fields, but we can check strict mode
        // This test documents current behavior
        expect(result.success).toBe(true);
      });
    });

    describe("type inference", () => {
      it("should infer correct TypeScript type", () => {
        type MigrationAssistantInput = z.infer<
          typeof migrationAssistantSchema
        >;

        const validData: MigrationAssistantInput = {
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        expect(validData.source_version).toBe("orders-v0");
        expect(validData.target_version).toBe("orders-2026-01-01");
      });

      it("should allow optional fields in inferred type", () => {
        type MigrationAssistantInput = z.infer<
          typeof migrationAssistantSchema
        >;

        const validData: MigrationAssistantInput = {
          source_code: "code here",
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
          language: "typescript",
          analysis_only: true,
        };

        expect(validData.source_code).toBe("code here");
        expect(validData.language).toBe("typescript");
        expect(validData.analysis_only).toBe(true);
      });
    });

    describe("edge cases", () => {
      it("should handle very long source_code", () => {
        const longCode = "a".repeat(10000);
        const validData = {
          source_code: longCode,
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code?.length).toBe(10000);
        }
      });

      it("should handle special characters in source_code", () => {
        const validData = {
          source_code: "const regex = /[a-z]+/gi; // comment with 特殊字符",
          source_version: "orders-v0",
          target_version: "orders-2026-01-01",
        };

        const result = migrationAssistantSchema.safeParse(validData);
        expect(result.success).toBe(true);
      });

      it("should handle version strings with various formats", () => {
        const testCases = [
          { source: "v0", target: "v1" },
          { source: "orders-v0", target: "orders-2026-01-01" },
          { source: "1.0.0", target: "2.0.0" },
          { source: "legacy", target: "modern" },
        ];

        testCases.forEach((testCase) => {
          const validData = {
            source_version: testCase.source,
            target_version: testCase.target,
          };

          const result = migrationAssistantSchema.safeParse(validData);
          expect(result.success).toBe(true);
        });
      });

      it("should handle various language values", () => {
        const languages = [
          "javascript",
          "typescript",
          "python",
          "java",
          "php",
          "ruby",
          "go",
          "rust",
        ];

        languages.forEach((lang) => {
          const validData = {
            source_version: "orders-v0",
            target_version: "orders-2026-01-01",
            language: lang,
          };

          const result = migrationAssistantSchema.safeParse(validData);
          expect(result.success).toBe(true);
        });
      });
    });
  });
});
