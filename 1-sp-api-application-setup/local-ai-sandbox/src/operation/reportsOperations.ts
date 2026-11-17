import { randomUUID } from "node:crypto";
import { OperationHandler } from "./operationTypes.js";
import { Api, Context } from "../database/Context.js";
import { REPORT_GENERATORS } from "../service/reportGeneratorService.js";

// --- createReport ---

export const createReportHandler: OperationHandler = async (validationResult, request) => {
  const { reportType, marketplaceIds, dataStartTime, dataEndTime, reportOptions } = request.body as Record<string, unknown>;

  const reportId = `REP-${randomUUID().slice(0, 8).toUpperCase()}`;
  const documentId = `DOC-${randomUUID().slice(0, 8).toUpperCase()}`;
  const generator = REPORT_GENERATORS[reportType as string];
  const content = generator((reportOptions as Record<string, string>) ?? {});

  Context.instance.engine.put(Api.REPORTS, documentId, { content, contentType: "text/tab-separated-values" });
  Context.instance.engine.put(Api.REPORTS, reportId, {
    reportId,
    reportType,
    marketplaceIds,
    dataStartTime,
    dataEndTime,
    reportOptions,
    processingStatus: "DONE",
    reportDocumentId: documentId,
    createdTime: new Date().toISOString(),
    processingStartTime: new Date().toISOString(),
    processingEndTime: new Date().toISOString(),
  });

  return {
    statusCode: 202,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: request.body as Record<string, unknown>,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { reportId } },
  };
};

// --- getReport ---

export const getReportHandler: OperationHandler = async (validationResult) => {
  const report = validationResult.resolvedEntities.report;
  const { content: _, _key: _k, ...metadata } = report;

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: metadata },
  };
};

// --- getReports ---

export const getReportsHandler: OperationHandler = async (validationResult) => {
  const collection = Context.instance.engine.getCollection(Api.REPORTS);
  const allDocs = collection
    ? collection.find().map((d) => {
        const { $loki, meta, _key, ...rest } = d as Record<string, unknown>;
        return rest;
      })
    : [];

  const reportTypes = validationResult.queryParams.reportTypes as string | undefined;
  const reports = allDocs
    .filter((r: Record<string, unknown>) => r.reportId && !r.content)
    .filter((r: Record<string, unknown>) => !reportTypes || reportTypes.split(",").includes(r.reportType as string));

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { reports } },
  };
};

// --- cancelReport ---

export const cancelReportHandler: OperationHandler = async (validationResult) => {
  const reportId = validationResult.pathParams.reportId;
  const report = validationResult.resolvedEntities.report;

  report.processingStatus = "CANCELLED";
  Context.instance.engine.put(Api.REPORTS, reportId, report);

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {},
  };
};

// --- getReportDocument ---

export const getReportDocumentHandler: OperationHandler = async (validationResult, request) => {
  const reportDocumentId = validationResult.pathParams.reportDocumentId;
  const host = request.get("host") ?? "localhost:9001";

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {
      body: {
        reportDocumentId,
        url: `http://${host}/reports/download/${reportDocumentId}`,
      },
    },
  };
};

// --- createReportSchedule ---

export const createReportScheduleHandler: OperationHandler = async (validationResult, request) => {
  const scheduleId = `SCHED-${randomUUID().slice(0, 8).toUpperCase()}`;
  Context.instance.engine.put(Api.REPORTS, scheduleId, {
    reportScheduleId: scheduleId,
    ...(request.body as Record<string, unknown>),
    createdTime: new Date().toISOString(),
  });

  return {
    statusCode: 201,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: request.body as Record<string, unknown>,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { reportScheduleId: scheduleId } },
  };
};

// --- getReportSchedule ---

export const getReportScheduleHandler: OperationHandler = async (validationResult) => {
  const schedule = validationResult.resolvedEntities["report schedule"];
  const { _key: _, ...data } = schedule;

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: data },
  };
};

// --- getReportSchedules ---

export const getReportSchedulesHandler: OperationHandler = async (validationResult) => {
  const collection = Context.instance.engine.getCollection(Api.REPORTS);
  const allDocs = collection
    ? collection.find().map((d) => {
        const { $loki, meta, _key, ...rest } = d as Record<string, unknown>;
        return rest;
      })
    : [];

  const schedules = allDocs.filter((r: Record<string, unknown>) => r.reportScheduleId);

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: { body: { reportSchedules: schedules } },
  };
};

// --- cancelReportSchedule ---

export const cancelReportScheduleHandler: OperationHandler = async (validationResult) => {
  const reportScheduleId = validationResult.pathParams.reportScheduleId;
  await Context.instance.engine.remove(Api.REPORTS, reportScheduleId);

  return {
    statusCode: 200,
    operationId: validationResult.operationId,
    apiName: validationResult.apiName,
    apiVersion: validationResult.apiVersion,
    pathParams: validationResult.pathParams,
    queryParams: validationResult.queryParams,
    body: undefined,
    operation: validationResult.operation,
    resolvedEntities: validationResult.resolvedEntities,
    data: {},
  };
};
