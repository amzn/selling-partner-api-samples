import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface SPAPIConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  baseUrl?: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class SPAPIAuth {
  private config: SPAPIConfig;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;
  private axiosInstance: AxiosInstance;

  constructor(config: SPAPIConfig) {
    this.config = config;
    this.axiosInstance = axios.create();
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const response = await this.axiosInstance.post<TokenResponse>(
        "https://api.amazon.com/auth/o2/token",
        {
          grant_type: "refresh_token",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          refresh_token: this.config.refreshToken,
        },
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + (response.data.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      throw new Error(
        `Failed to get access token: ${error.response?.data?.error_description || error.message}`,
      );
    }
  }

  async makeAuthenticatedRequest<T = any>(
    method: string,
    url: string,
    params: Record<string, string> = {},
    data: any = null,
  ): Promise<AxiosResponse<T>> {
    const accessToken = await this.getAccessToken();

    const config: AxiosRequestConfig = {
      method,
      url,
      headers: {
        "x-amz-access-token": accessToken!,
        "Content-Type": "application/json",
        "User-Agent": "SP-API-Dev-Assistant-MCP/0.0.1",
      },
      params,
      timeout: 30000,
    };

    if (data && (method === "POST" || method === "PUT")) {
      config.data = data;
    }

    return this.axiosInstance.request<T>(config);
  }
}
