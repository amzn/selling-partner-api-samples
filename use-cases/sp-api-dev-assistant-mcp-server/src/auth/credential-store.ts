/**
 * In-memory credential store for SP-API credentials
 * Allows runtime configuration of credentials via MCP tool
 */

export interface SPAPICredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  baseUrl: string;
}

export interface CredentialStoreStatus {
  isConfigured: boolean;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasRefreshToken: boolean;
  baseUrl: string;
  configuredAt?: Date;
}

class CredentialStore {
  private static instance: CredentialStore;
  private credentials: Partial<SPAPICredentials> = {};
  private configuredAt?: Date;

  private constructor() {
    // Initialize from environment variables if available
    this.credentials = {
      clientId: process.env.SP_API_CLIENT_ID,
      clientSecret: process.env.SP_API_CLIENT_SECRET,
      refreshToken: process.env.SP_API_REFRESH_TOKEN,
      baseUrl:
        process.env.SP_API_BASE_URL ||
        "https://sellingpartnerapi-na.amazon.com",
    };

    if (this.isConfigured()) {
      this.configuredAt = new Date();
    }
  }

  static getInstance(): CredentialStore {
    if (!CredentialStore.instance) {
      CredentialStore.instance = new CredentialStore();
    }
    return CredentialStore.instance;
  }

  setCredentials(credentials: Partial<SPAPICredentials>): void {
    if (credentials.clientId) {
      this.credentials.clientId = credentials.clientId;
    }
    if (credentials.clientSecret) {
      this.credentials.clientSecret = credentials.clientSecret;
    }
    if (credentials.refreshToken) {
      this.credentials.refreshToken = credentials.refreshToken;
    }
    if (credentials.baseUrl) {
      this.credentials.baseUrl = credentials.baseUrl;
    }
    this.configuredAt = new Date();
  }

  getCredentials(): Partial<SPAPICredentials> {
    return { ...this.credentials };
  }

  isConfigured(): boolean {
    return !!(
      this.credentials.clientId &&
      this.credentials.clientSecret &&
      this.credentials.refreshToken
    );
  }

  getStatus(): CredentialStoreStatus {
    return {
      isConfigured: this.isConfigured(),
      hasClientId: !!this.credentials.clientId,
      hasClientSecret: !!this.credentials.clientSecret,
      hasRefreshToken: !!this.credentials.refreshToken,
      baseUrl:
        this.credentials.baseUrl || "https://sellingpartnerapi-na.amazon.com",
      configuredAt: this.configuredAt,
    };
  }

  clearCredentials(): void {
    this.credentials = {
      baseUrl: "https://sellingpartnerapi-na.amazon.com",
    };
    this.configuredAt = undefined;
  }

  getMaskedCredentials(): Record<string, string> {
    const mask = (value?: string): string => {
      if (!value) return "(not set)";
      if (value.length <= 8) return "****";
      return value.substring(0, 4) + "****" + value.substring(value.length - 4);
    };

    return {
      clientId: mask(this.credentials.clientId),
      clientSecret: mask(this.credentials.clientSecret),
      refreshToken: mask(this.credentials.refreshToken),
      baseUrl: this.credentials.baseUrl || "(default)",
    };
  }
}

export const credentialStore = CredentialStore.getInstance();
