import { describe, it, expect } from "vitest";
import { OptimizationTool } from "../../src/tools/optimization-tools/optimization-tool.js";

const tool = new OptimizationTool();

describe("OptimizationTool", () => {
  describe("no source_code", () => {
    it("returns markdown with empty issues and best practices", async () => {
      const result = await tool.handleRequest({});
      const markdown = result.content[0].text;
      // Verify markdown structure
      expect(markdown).toContain("# 🔧 SP-API Optimization Report");
      expect(markdown).toContain("## 📊 Analysis Summary");
      expect(markdown).toContain("| Optimization Opportunities | 0 |");
      expect(markdown).toContain("## ✅ Best Practices");
      expect(result.isError).toBeUndefined();
    });

    it("returns section-specific best practices when apiSection provided", async () => {
      const result = await tool.handleRequest({ apiSection: "Orders" });
      const markdown = result.content[0].text;
      expect(markdown).toContain("## ✅ Best Practices");
      expect(/order/i.test(markdown)).toBe(true);
    });

    it("returns FBA Inbound best practices", async () => {
      const result = await tool.handleRequest({ apiSection: "fba_inbound" });
      const markdown = result.content[0].text;
      expect(/inbound/i.test(markdown)).toBe(true);
    });

    it("returns Finances best practices", async () => {
      const result = await tool.handleRequest({ apiSection: "finances" });
      const markdown = result.content[0].text;
      expect(/transaction/i.test(markdown)).toBe(true);
    });

    it("returns Fulfillment best practices", async () => {
      const result = await tool.handleRequest({ apiSection: "fulfillment" });
      const markdown = result.content[0].text;
      expect(/fulfillment|delivery/i.test(markdown)).toBe(true);
    });

    it("returns Sellers best practices", async () => {
      const result = await tool.handleRequest({ apiSection: "sellers" });
      const markdown = result.content[0].text;
      expect(/marketplace/i.test(markdown)).toBe(true);
    });

    it("returns Data Kiosk best practices", async () => {
      const result = await tool.handleRequest({ apiSection: "data_kiosk" });
      const markdown = result.content[0].text;
      expect(/data kiosk|analytics/i.test(markdown)).toBe(true);
    });

    it("treats whitespace-only source_code as absent", async () => {
      const result = await tool.handleRequest({ source_code: "   \n\t  " });
      const markdown = result.content[0].text;
      expect(markdown).toContain("| Optimization Opportunities | 0 |");
    });
  });

  describe("with source_code", () => {
    it("detects missing error handling", async () => {
      const code = `
        const orders = await ordersApi.getOrder(orderId);
        console.log(orders);
      `;
      const result = await tool.handleRequest({ source_code: code });
      const markdown = result.content[0].text;
      expect(markdown).toContain("## ⚠️ Identified Issues");
      expect(markdown).toContain("## 💡 Recommendations");
    });

    it("filters by optimization_goals", async () => {
      const code = `
        const orders = await ordersApi.getOrder(orderId);
        console.log(orders);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["batching"],
      });
      const markdown = result.content[0].text;
      // Should only contain batching-related issues if any
      if (markdown.includes("## ⚠️ Identified Issues")) {
        expect(markdown.toLowerCase()).toContain("batch");
      }
    });

    it("detects batching opportunities", async () => {
      const code = `
        try {
          const item = await catalogApi.getCatalogItem(asin);
        } catch (e) { retry(); }
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["batching"],
      });
      const markdown = result.content[0].text;
      expect(markdown.toLowerCase()).toContain("batch");
    });

    it("detects scheduling issues with tight intervals", async () => {
      const code = `
        setInterval(() => client.getOrder(id), 5000);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["scheduling"],
      });
      const markdown = result.content[0].text;
      // Should detect high severity issue
      expect(markdown).toMatch(/HIGH|🔴/i);
    });
  });

  describe("response structure", () => {
    it("always has the required markdown sections", async () => {
      const result = await tool.handleRequest({ source_code: "const x = 1;" });
      const markdown = result.content[0].text;
      expect(markdown).toContain("# 🔧 SP-API Optimization Report");
      expect(markdown).toContain("## 📊 Analysis Summary");
      expect(markdown).toContain("## ✅ Best Practices");
    });

    it("analysis_summary includes call_reduction_rate", async () => {
      const code = `
        for (const id of ids) {
          const order = await axios.get(\`\${baseUrl}/orders/v0/orders/\${id}\`);
        }
      `;
      const result = await tool.handleRequest({ source_code: code });
      const markdown = result.content[0].text;
      expect(markdown).toContain("| Call Reduction Rate |");
    });

    it("call_reduction_rate is 0 when no call reduction findings", async () => {
      const result = await tool.handleRequest({ source_code: "const x = 1;" });
      const markdown = result.content[0].text;
      expect(markdown).toContain("| Call Reduction Rate | 0% |");
    });

    it("recommendations have REC-NNN format IDs", async () => {
      const code = `
        const item = await catalogApi.getCatalogItem(asin);
      `;
      const result = await tool.handleRequest({ source_code: code });
      const markdown = result.content[0].text;
      // Check for REC-NNN pattern in markdown
      expect(/REC-\d{3}/.test(markdown)).toBe(true);
    });

    it("each recommendation has complete structure in markdown", async () => {
      const code = `
        const item = await catalogApi.getCatalogItem(asin);
      `;
      const result = await tool.handleRequest({ source_code: code });
      const markdown = result.content[0].text;
      // Verify recommendation structure in markdown
      expect(markdown).toContain("## 💡 Recommendations");
      expect(markdown).toContain("**Category:**");
      expect(markdown).toContain("**Priority:**");
    });
  });

  describe("error handling", () => {
    it("never crashes on arbitrary input", async () => {
      const inputs = [
        { source_code: "" },
        { source_code: "x".repeat(100000) },
        { source_code: "}{][)(\\\\///" },
        { apiSection: "" },
        { optimization_goals: [] as string[] },
      ];
      for (const input of inputs) {
        const result = await tool.handleRequest(input as any);
        expect(result.content).toBeDefined();
        expect(result.content.length).toBeGreaterThan(0);
      }
    });
  });

  describe("api_modernness detection", () => {
    it("detects deprecated Orders API v0 SDK class", async () => {
      const code = `
        const ordersApi = new OrdersV0Api(config);
        const orders = await ordersApi.getOrders(params);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("Orders API v0");
      expect(markdown).toContain("v2026-01-01");
    });

    it("detects deprecated Orders API v0 endpoint", async () => {
      const code = `
        const response = await axios.get('https://sellingpartnerapi.amazon.com/orders/v0/orders');
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("Orders API v0");
    });

    it("detects deprecated getOrderBuyerInfo operation", async () => {
      const code = `
        const buyerInfo = await ordersApi.getOrderBuyerInfo(orderId);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("getOrderBuyerInfo");
      expect(markdown).toContain("includedData");
    });

    it("detects deprecated Fulfillment Inbound API v0 endpoint", async () => {
      const code = `
        const response = await fetch('/fba/inbound/v0/shipments');
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("Fulfillment Inbound API v0");
      expect(markdown).toContain("v2024-03-20");
    });

    it("detects deprecated createInboundShipmentPlan operation", async () => {
      const code = `
        const plan = await inboundApi.createInboundShipmentPlan(request);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("createInboundShipmentPlan");
      expect(markdown).toContain("createInboundPlan");
    });

    it("detects deprecated feed types", async () => {
      const code = `
        const feedType = 'POST_PRODUCT_DATA';
        await feedsApi.createFeed({ feedType });
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("POST_PRODUCT_DATA");
      expect(markdown).toContain("JSON_LISTINGS_FEED");
    });

    it("detects deprecated POST_FLAT_FILE_LISTINGS_DATA feed", async () => {
      const code = `
        const feedType = '_POST_FLAT_FILE_LISTINGS_DATA_';
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("POST_FLAT_FILE_LISTINGS_DATA");
    });

    it("filters api_modernness by apiSection", async () => {
      const code = `
        const ordersApi = new OrdersV0Api(config);
        const inboundApi = new FulfillmentInboundV0Api(config);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
        apiSection: "Orders",
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("Orders API v0");
      // Should not contain FBA Inbound issues when filtered to Orders
      expect(markdown).not.toContain("Fulfillment Inbound API v0");
    });

    it("returns no api_modernness issues for modern API usage", async () => {
      const code = `
        const response = await axios.get('/orders/2026-01-01/orders');
        const inboundPlans = await fetch('/inbound/fba/2024-03-20/inboundPlans');
        const feedType = 'JSON_LISTINGS_FEED';
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      // Should have 0 optimization opportunities for api_modernness
      expect(markdown).toContain("| Optimization Opportunities | 0 |");
    });

    it("includes migration guide links in recommendations", async () => {
      const code = `
        const ordersApi = new OrdersV0Api(config);
      `;
      const result = await tool.handleRequest({
        source_code: code,
        optimization_goals: ["api_modernness"],
      });
      const markdown = result.content[0].text;
      expect(markdown).toContain("migration");
    });
  });
});
