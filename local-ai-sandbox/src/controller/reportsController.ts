import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { Context } from "../database/Context.js";
import { REPORT_GENERATORS } from "../service/reportGeneratorService.js";
import { validateReport, REPORT_META } from "../service/reportValidationService.js";

const db = () => Context.instance.db;

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const createReport = async (req: Request, res: Response) => {
  const { reportType, marketplaceIds, dataStartTime, dataEndTime, reportOptions } = req.body;
  if (DANGEROUS_KEYS.has(reportType) || !Object.hasOwn(REPORT_GENERATORS, reportType)) {
    res.status(400).json({
      errors: [{ code: "InvalidInput", message: `Unsupported reportType: ${reportType}. Supported: ${Object.keys(REPORT_GENERATORS).join(", ")}` }],
    });
    return;
  }
  const generator = REPORT_GENERATORS[reportType];
  if (!generator) {
    res.status(400).json({
      errors: [{ code: "InvalidInput", message: `Unsupported reportType: ${reportType}. Supported: ${Object.keys(REPORT_GENERATORS).join(", ")}` }],
    });
    return;
  }
  const validationError = validateReport(reportType, marketplaceIds, reportOptions, dataStartTime, dataEndTime);
  if (validationError) {
    res.status(400).json({ errors: [{ code: "InvalidInput", message: validationError }] });
    return;
  }
  const reportId = `REP-${randomUUID().slice(0, 8).toUpperCase()}`;
  const documentId = `DOC-${randomUUID().slice(0, 8).toUpperCase()}`;
  const content = generator(reportOptions ?? {});

  db().data.reports[documentId] = { content, contentType: "text/tab-separated-values" };
  db().data.reports[reportId] = {
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
  };
  await db().write();
  res.status(202).json({ reportId });
};

export const getReport = async (req: Request, res: Response) => {
  const report = db().data.reports[req.params.reportId as string];
  if (!report || report.content !== undefined) {
    res.status(404).json({ errors: [{ code: "NotFound", message: `Report ${req.params.reportId} not found` }] });
    return;
  }
  const { content: _, ...metadata } = report;
  res.status(200).json(metadata);
};

export const getReports = async (req: Request, res: Response) => {
  const reports = Object.values(db().data.reports)
    .filter((r: any) => r.reportId && !r.content)
    .filter((r: any) => !req.query.reportTypes || (req.query.reportTypes as string).split(",").includes(r.reportType));
  res.status(200).json({ reports });
};

export const cancelReport = async (req: Request, res: Response) => {
  const reportId = req.params.reportId as string;
  if (DANGEROUS_KEYS.has(reportId)) {
    res.status(400).json({ errors: [{ code: "InvalidInput", message: "Invalid reportId" }] });
    return;
  }
  const report = db().data.reports[reportId];
  if (!report || report.content !== undefined) {
    res.status(404).json({ errors: [{ code: "NotFound", message: `Report ${reportId} not found` }] });
    return;
  }
  report.processingStatus = "CANCELLED";
  await db().write();
  res.status(200).send();
};

export const getReportDocument = async (req: Request, res: Response) => {
  const doc = db().data.reports[req.params.reportDocumentId as string];
  if (doc?.content === undefined) {
    res.status(404).json({ errors: [{ code: "NotFound", message: `Document ${req.params.reportDocumentId} not found` }] });
    return;
  }
  res.status(200).json({
    reportDocumentId: req.params.reportDocumentId,
    url: `http://${req.host}/reports/download/${req.params.reportDocumentId}`,
  });
};

export const downloadReportDocument = async (req: Request, res: Response) => {
  const doc = db().data.reports[req.params.documentId as string];
  if (doc?.content === undefined) {
    res.status(404).json({ errors: [{ code: "NotFound", message: "Document not found" }] });
    return;
  }
  res.setHeader("Content-Type", doc.contentType ?? "text/plain");
  res.status(200).send(doc.content);
};

// Schedule operations — simple DB storage
export const createReportSchedule = async (req: Request, res: Response) => {
  const { reportType, marketplaceIds } = req.body;
  const meta = REPORT_META[reportType];
  if (meta && !meta.schedulable) {
    res.status(400).json({ errors: [{ code: "InvalidInput", message: `reportType ${reportType} can only be requested, not scheduled` }] });
    return;
  }
  const scheduleId = `SCHED-${randomUUID().slice(0, 8).toUpperCase()}`;
  db().data.reports[scheduleId] = { reportScheduleId: scheduleId, ...req.body, createdTime: new Date().toISOString() };
  await db().write();
  res.status(201).json({ reportScheduleId: scheduleId });
};

export const getReportSchedule = async (req: Request, res: Response) => {
  const schedule = db().data.reports[req.params.reportScheduleId as string];
  if (!schedule?.reportScheduleId) {
    res.status(404).json({ errors: [{ code: "NotFound", message: `Schedule ${req.params.reportScheduleId} not found` }] });
    return;
  }
  res.status(200).json(schedule);
};

export const getReportSchedules = async (req: Request, res: Response) => {
  const schedules = Object.values(db().data.reports).filter((r: any) => r.reportScheduleId);
  res.status(200).json({ reportSchedules: schedules });
};

export const cancelReportSchedule = async (req: Request, res: Response) => {
  const schedule = db().data.reports[req.params.reportScheduleId as string];
  if (!schedule?.reportScheduleId) {
    res.status(404).json({ errors: [{ code: "NotFound", message: `Schedule ${req.params.reportScheduleId} not found` }] });
    return;
  }
  delete db().data.reports[req.params.reportScheduleId as string];
  await db().write();
  res.status(200).send();
};
