import { describe, it, expect } from "vitest";
import { optimizationSchema } from "../../src/zod-schemas/optimization-schemas";
import { z } from "zod";

describe("Optimization Schemas", () => {
  describe("optimizationSchema", () => {
    describe("valid inputs", () => {
      it("should accept empty object (all fields optional)", () => {
        const result = optimizationSchema.safeParse({});
        expect(result.success).toBe(true);
      });

      it("should accept source_code only", () => {
        const result = optimizationSchema.safeParse({
          source_code: "const x = 1;",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code).toBe("const x = 1;");
        }
      });

      it("should accept all fields provided", () => {
        const result = optimizationSchema.safeParse({
          source_code: "await getOrders();",
          optimization_goals: ["error_handling", "batching"],
          apiSection: "Orders",
          language: "javascript",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code).toBe("await getOrders();");
          expect(result.data.optimization_goals).toEqual([
            "error_handling",
            "batching",
          ]);
          expect(result.data.apiSection).toBe("Orders");
          expect(result.data.language).toBe("javascript");
        }
      });

      it("should accept empty source_code string", () => {
        const result = optimizationSchema.safeParse({ source_code: "" });
        expect(result.success).toBe(true);
      });

      it("should accept each valid optimization goal individually", () => {
        const goals = [
          "error_handling",
          "rate_limiting",
          "batching",
          "caching",
          "pagination",
          "scheduling",
          "notifications",
          "reports",
          "call_reduction",
          "api_modernness",
        ];
        for (const goal of goals) {
          const result = optimizationSchema.safeParse({
            optimization_goals: [goal],
          });
          expect(result.success).toBe(true);
        }
      });

      it("should accept all optimization goals together", () => {
        const result = optimizationSchema.safeParse({
          optimization_goals: [
            "error_handling",
            "rate_limiting",
            "batching",
            "caching",
            "pagination",
            "scheduling",
            "notifications",
            "reports",
            "call_reduction",
            "api_modernness",
          ],
        });
        expect(result.success).toBe(true);
      });

      it("should accept empty optimization_goals array", () => {
        const result = optimizationSchema.safeParse({ optimization_goals: [] });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.optimization_goals).toEqual([]);
        }
      });

      it("should accept each valid language", () => {
        const languages = ["python", "javascript", "typescript", "java"];
        for (const lang of languages) {
          const result = optimizationSchema.safeParse({ language: lang });
          expect(result.success).toBe(true);
        }
      });

      it("should accept apiSection with any string", () => {
        const result = optimizationSchema.safeParse({ apiSection: "Catalog" });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.apiSection).toBe("Catalog");
        }
      });

      it("should accept multiline source_code", () => {
        const code = `
          const orders = await getOrders({
            marketplaceIds: ['ATVPDKIKX0DER'],
          });
        `;
        const result = optimizationSchema.safeParse({ source_code: code });
        expect(result.success).toBe(true);
      });
    });

    describe("invalid inputs", () => {
      it("should reject non-string source_code", () => {
        const result = optimizationSchema.safeParse({ source_code: 123 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("source_code");
        }
      });

      it("should reject invalid optimization goal", () => {
        const result = optimizationSchema.safeParse({
          optimization_goals: ["invalid_goal"],
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path[0]).toBe("optimization_goals");
        }
      });

      it("should reject non-array optimization_goals", () => {
        const result = optimizationSchema.safeParse({
          optimization_goals: "batching",
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("optimization_goals");
        }
      });

      it("should reject invalid language", () => {
        const result = optimizationSchema.safeParse({ language: "ruby" });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("language");
        }
      });

      it("should reject non-string language", () => {
        const result = optimizationSchema.safeParse({ language: 42 });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("language");
        }
      });

      it("should reject non-string apiSection", () => {
        const result = optimizationSchema.safeParse({ apiSection: true });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0].path).toContain("apiSection");
        }
      });

      it("should reject mixed valid and invalid goals", () => {
        const result = optimizationSchema.safeParse({
          optimization_goals: ["batching", "not_a_goal"],
        });
        expect(result.success).toBe(false);
      });
    });

    describe("type inference", () => {
      it("should infer correct TypeScript type", () => {
        type OptimizationInput = z.infer<typeof optimizationSchema>;

        const validData: OptimizationInput = {
          source_code: "code here",
          optimization_goals: ["batching", "caching"],
          apiSection: "Orders",
          language: "python",
        };

        expect(validData.source_code).toBe("code here");
        expect(validData.optimization_goals).toEqual(["batching", "caching"]);
        expect(validData.apiSection).toBe("Orders");
        expect(validData.language).toBe("python");
      });

      it("should allow all fields omitted in inferred type", () => {
        type OptimizationInput = z.infer<typeof optimizationSchema>;
        const validData: OptimizationInput = {};
        expect(validData).toEqual({});
      });
    });

    describe("edge cases", () => {
      it("should handle very long source_code", () => {
        const longCode = "a".repeat(10000);
        const result = optimizationSchema.safeParse({ source_code: longCode });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.source_code?.length).toBe(10000);
        }
      });

      it("should handle special characters in source_code", () => {
        const result = optimizationSchema.safeParse({
          source_code: "const regex = /[a-z]+/gi; // 特殊字符",
        });
        expect(result.success).toBe(true);
      });

      it("should accept extra unknown fields without failing", () => {
        const result = optimizationSchema.safeParse({
          source_code: "code",
          unknown_field: "value",
        });
        expect(result.success).toBe(true);
      });

      it("should handle duplicate goals in array", () => {
        const result = optimizationSchema.safeParse({
          optimization_goals: ["batching", "batching"],
        });
        expect(result.success).toBe(true);
      });
    });
  });
});
