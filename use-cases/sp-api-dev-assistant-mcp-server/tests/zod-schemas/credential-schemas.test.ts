import { credentialToolSchema } from "../../src/zod-schemas/credential-schemas";

describe("credentialToolSchema", () => {
  describe("action field", () => {
    it("should accept 'configure' action", () => {
      const result = credentialToolSchema.safeParse({ action: "configure" });
      expect(result.success).toBe(true);
    });

    it("should accept 'status' action", () => {
      const result = credentialToolSchema.safeParse({ action: "status" });
      expect(result.success).toBe(true);
    });

    it("should accept 'clear' action", () => {
      const result = credentialToolSchema.safeParse({ action: "clear" });
      expect(result.success).toBe(true);
    });

    it("should reject invalid action", () => {
      const result = credentialToolSchema.safeParse({ action: "invalid" });
      expect(result.success).toBe(false);
    });

    it("should require action field", () => {
      const result = credentialToolSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  describe("configure action with credentials", () => {
    it("should accept all credential fields", () => {
      const result = credentialToolSchema.safeParse({
        action: "configure",
        clientId: "amzn1.application-oa2-client.xxx",
        clientSecret: "secret",
        refreshToken: "Atzr|xxx",
        baseUrl: "na",
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial credentials", () => {
      const result = credentialToolSchema.safeParse({
        action: "configure",
        clientId: "amzn1.application-oa2-client.xxx",
      });
      expect(result.success).toBe(true);
    });

    it("should accept full URL for baseUrl", () => {
      const result = credentialToolSchema.safeParse({
        action: "configure",
        baseUrl: "https://sellingpartnerapi-na.amazon.com",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("status and clear actions", () => {
    it("should ignore credential fields for status action", () => {
      const result = credentialToolSchema.safeParse({
        action: "status",
        clientId: "ignored",
      });
      expect(result.success).toBe(true);
    });

    it("should ignore credential fields for clear action", () => {
      const result = credentialToolSchema.safeParse({
        action: "clear",
        clientId: "ignored",
      });
      expect(result.success).toBe(true);
    });
  });
});
