import { SPAPIAuth } from "../../src/auth/sp-api-auth";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("SPAPIAuth", () => {
  let auth: SPAPIAuth;
  const mockConfig = {
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    refreshToken: "test-refresh-token",
    baseUrl: "https://sellingpartnerapi-na.amazon.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.create.mockReturnValue(mockedAxios as any);
  });

  describe("constructor", () => {
    it("should create an instance with valid config", () => {
      auth = new SPAPIAuth(mockConfig);
      expect(auth).toBeInstanceOf(SPAPIAuth);
    });
  });

  describe("makeAuthenticatedRequest", () => {
    beforeEach(() => {
      auth = new SPAPIAuth(mockConfig);
    });

    it("should get access token and make authenticated request", async () => {
      const mockTokenResponse = {
        data: {
          access_token: "test-access-token",
          expires_in: 3600,
          token_type: "bearer",
        },
      };

      const mockApiResponse = {
        data: { orders: [] },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.request.mockResolvedValueOnce(mockApiResponse);

      const result = await auth.makeAuthenticatedRequest(
        "GET",
        "https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders",
        { marketplaceIds: "ATVPDKIKX0DER" },
      );

      expect(mockedAxios.post).toHaveBeenCalledWith(
        "https://api.amazon.com/auth/o2/token",
        expect.objectContaining({
          grant_type: "refresh_token",
          client_id: mockConfig.clientId,
          client_secret: mockConfig.clientSecret,
          refresh_token: mockConfig.refreshToken,
        }),
        expect.any(Object),
      );

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "x-amz-access-token": "test-access-token",
          }),
        }),
      );

      expect(result.data).toEqual({ orders: [] });
    });

    it("should reuse cached access token if not expired", async () => {
      const mockTokenResponse = {
        data: {
          access_token: "test-access-token",
          expires_in: 3600,
          token_type: "bearer",
        },
      };

      const mockApiResponse = {
        data: { orders: [] },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.request.mockResolvedValue(mockApiResponse);

      // First request - should get new token
      await auth.makeAuthenticatedRequest(
        "GET",
        "https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders",
      );

      // Second request - should reuse token
      await auth.makeAuthenticatedRequest(
        "GET",
        "https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders",
      );

      // Token should only be fetched once
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
      expect(mockedAxios.request).toHaveBeenCalledTimes(2);
    });

    it("should handle token refresh errors", async () => {
      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: {
            error_description: "Invalid refresh token",
          },
        },
      });

      await expect(
        auth.makeAuthenticatedRequest(
          "GET",
          "https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders",
        ),
      ).rejects.toThrow("Failed to get access token: Invalid refresh token");
    });

    it("should include request body for POST requests", async () => {
      const mockTokenResponse = {
        data: {
          access_token: "test-access-token",
          expires_in: 3600,
          token_type: "bearer",
        },
      };

      const mockApiResponse = {
        data: { success: true },
        status: 200,
      };

      mockedAxios.post.mockResolvedValueOnce(mockTokenResponse);
      mockedAxios.request.mockResolvedValueOnce(mockApiResponse);

      const requestBody = { cancelReasonCode: "NO_INVENTORY" };

      await auth.makeAuthenticatedRequest(
        "POST",
        "https://sellingpartnerapi-na.amazon.com/orders/2026-01-01/orders/123/cancellation",
        {},
        requestBody,
      );

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          data: requestBody,
        }),
      );
    });
  });
});
