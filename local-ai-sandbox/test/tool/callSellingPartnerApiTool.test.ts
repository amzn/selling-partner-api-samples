import { describe, it, expect, vi, afterEach } from "vitest";
import { callSellingPartnerApiTool } from "../../src/tool/callSellingPartnerApiTool.js";
import { asyncLocalStorage } from "../../src/index.js";

describe("callSellingPartnerApiTool", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("handles request when headers parameter is omitted", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ success: true }),
      headers: new Map(),
    });
    globalThis.fetch = mockFetch as any;

    await asyncLocalStorage.run({ accessToken: "test-access-token" }, async () => {
      const result: any = await callSellingPartnerApiTool.invoke({
        method: "GET",
        url: "https://example.com/api",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const fetchOpts = mockFetch.mock.calls[0][1];
      expect(fetchOpts.headers["x-amz-access-token"]).toBe("test-access-token");
      expect(JSON.parse(result.body)).toEqual({ success: true });
    });
  });

  it("safely handles call when asyncLocalStorage store is empty", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "ok",
      headers: new Map(),
    });
    globalThis.fetch = mockFetch as any;

    const result: any = await callSellingPartnerApiTool.invoke({
      method: "GET",
      url: "https://example.com/api",
    });

    expect(result.status).toBe(200);
    const fetchOpts = mockFetch.mock.calls[0][1];
    expect(fetchOpts.headers["x-amz-access-token"]).toBeUndefined();
  });

  it("includes response error body when HTTP response is not ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      text: async () => JSON.stringify({ errors: [{ code: "InvalidInput", message: "Bad field" }] }),
      headers: new Map(),
    });
    globalThis.fetch = mockFetch as any;

    await expect(
      callSellingPartnerApiTool.invoke({
        method: "POST",
        url: "https://example.com/api",
      })
    ).rejects.toThrow("HTTP 400 Bad Request: POST https://example.com/api - Response: {\"errors\":[{\"code\":\"InvalidInput\",\"message\":\"Bad field\"}]}");
  });
});
