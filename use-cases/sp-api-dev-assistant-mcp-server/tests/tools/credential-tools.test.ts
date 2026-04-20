import { CredentialTools } from "../../src/tools/auth-tools/credential-tools";
import { credentialStore } from "../../src/auth/credential-store";

describe("CredentialTools", () => {
  let credentialTools: CredentialTools;

  beforeEach(() => {
    credentialTools = new CredentialTools();
    credentialStore.clearCredentials();
  });

  describe("handleCredentials", () => {
    describe("action: configure", () => {
      it("should configure credentials successfully", () => {
        const result = credentialTools.handleCredentials({
          action: "configure",
          clientId: "amzn1.application-oa2-client.test123",
          clientSecret: "test-secret",
          refreshToken: "Atzr|test-token",
          baseUrl: "na",
        });

        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain("Credentials fully configured");
        expect(result.content[0].text).toContain("clientId, clientSecret, refreshToken, baseUrl");
      });

      it("should resolve region shorthand to full URL", () => {
        credentialTools.handleCredentials({
          action: "configure",
          clientId: "test-id",
          clientSecret: "test-secret",
          refreshToken: "test-token",
          baseUrl: "eu",
        });

        const status = credentialStore.getStatus();
        expect(status.baseUrl).toBe("https://sellingpartnerapi-eu.amazon.com");
      });

      it("should return error when no credentials provided", () => {
        const result = credentialTools.handleCredentials({
          action: "configure",
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("No credentials provided");
      });

      it("should allow partial credential updates", () => {
        // First configure some credentials
        credentialTools.handleCredentials({
          action: "configure",
          clientId: "test-id",
        });

        // Then add more
        const result = credentialTools.handleCredentials({
          action: "configure",
          clientSecret: "test-secret",
        });

        expect(result.isError).toBeUndefined();
        expect(result.content[0].text).toContain("Credentials partially configured");
        
        const status = credentialStore.getStatus();
        expect(status.hasClientId).toBe(true);
        expect(status.hasClientSecret).toBe(true);
      });
    });

    describe("action: status", () => {
      it("should show unconfigured status when no credentials set", () => {
        const result = credentialTools.handleCredentials({
          action: "status",
        });

        expect(result.content[0].text).toContain("Not fully configured");
        expect(result.content[0].text).toContain("❌");
      });

      it("should show configured status when all credentials set", () => {
        credentialStore.setCredentials({
          clientId: "test-id",
          clientSecret: "test-secret",
          refreshToken: "test-token",
        });

        const result = credentialTools.handleCredentials({
          action: "status",
        });

        expect(result.content[0].text).toContain("Fully configured");
        expect(result.content[0].text).toContain("✅");
      });

      it("should show masked credentials", () => {
        credentialStore.setCredentials({
          clientId: "amzn1.application-oa2-client.abcdef123456",
          clientSecret: "supersecretvalue",
          refreshToken: "Atzr|verylongtoken",
        });

        const result = credentialTools.handleCredentials({
          action: "status",
        });

        // Credentials should be masked (format: first4****last4)
        expect(result.content[0].text).toContain("amzn****3456");
        expect(result.content[0].text).not.toContain("supersecretvalue");
        expect(result.content[0].text).not.toContain("verylongtoken");
      });
    });

    describe("action: clear", () => {
      it("should clear all credentials", () => {
        credentialStore.setCredentials({
          clientId: "test-id",
          clientSecret: "test-secret",
          refreshToken: "test-token",
        });

        const result = credentialTools.handleCredentials({
          action: "clear",
        });

        expect(result.content[0].text).toContain("Credentials Cleared");

        const status = credentialStore.getStatus();
        expect(status.hasClientId).toBe(false);
        expect(status.hasClientSecret).toBe(false);
        expect(status.hasRefreshToken).toBe(false);
      });
    });

    describe("invalid action", () => {
      it("should return error for unknown action", () => {
        const result = credentialTools.handleCredentials({
          action: "invalid" as any,
        });

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toContain("Unknown action");
      });
    });
  });
});
