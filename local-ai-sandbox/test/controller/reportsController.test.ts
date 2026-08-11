import { describe, it, expect, beforeEach } from "vitest";
import { Context } from "../../src/database/Context.js";
import {
  createReport,
  getReport,
  getReportDocument,
} from "../../src/controller/reportsController.js";

function createMockReqRes(params: any = {}, body: any = {}, query: any = {}, headers: any = {}) {
  const req: any = {
    params,
    body,
    query,
    headers,
    get: (headerName: string) => headers[headerName.toLowerCase()] || headers[headerName],
  };

  let responseData: { statusCode?: number; jsonBody?: any; sentContent?: any; headersSent?: Record<string, string> } = {};

  const res: any = {
    status: (code: number) => {
      responseData.statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData.jsonBody = data;
      return res;
    },
    send: (data?: any) => {
      responseData.sentContent = data;
      return res;
    },
    setHeader: (key: string, val: string) => {
      responseData.headersSent = responseData.headersSent || {};
      responseData.headersSent[key] = val;
      return res;
    },
  };

  return { req, res, responseData };
}

describe("reportsController", () => {
  beforeEach(async () => {
    await Context.instance.clear();
  });

  it("creates a report successfully", async () => {
    const { req, res, responseData } = createMockReqRes(
      {},
      { reportType: "GET_AFN_INVENTORY_DATA", marketplaceIds: ["ATVPDKIKX0DER"] }
    );

    await createReport(req, res);

    expect(responseData.statusCode).toBe(202);
    expect(responseData.jsonBody.reportId).toMatch(/^REP-/);
  });

  it("rejects unsupported or dangerous report types", async () => {
    const { req, res, responseData } = createMockReqRes({}, { reportType: "__proto__" });

    await createReport(req, res);

    expect(responseData.statusCode).toBe(400);
    expect(responseData.jsonBody.errors[0].code).toBe("InvalidInput");
  });

  it("generates report document URL preserving host and port", async () => {
    const createReqRes = createMockReqRes(
      {},
      { reportType: "GET_AFN_INVENTORY_DATA", marketplaceIds: ["ATVPDKIKX0DER"] }
    );
    await createReport(createReqRes.req, createReqRes.res);

    const reportId = createReqRes.responseData.jsonBody.reportId;
    const reportData = Context.instance.db.data.reports[reportId];
    const docId = reportData.reportDocumentId;

    const { req, res, responseData } = createMockReqRes(
      { reportDocumentId: docId },
      {},
      {},
      { host: "localhost:9001" }
    );

    await getReportDocument(req, res);

    expect(responseData.statusCode).toBe(200);
    expect(responseData.jsonBody.url).toBe(`http://localhost:9001/reports/download/${docId}`);
  });

  it("prevents prototype key manipulation on report details fetch", async () => {
    const { req, res, responseData } = createMockReqRes({ reportId: "__proto__" });

    await getReport(req, res);

    expect(responseData.statusCode).toBe(400);
  });
});
