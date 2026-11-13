import { Request, Response } from "express";
import { validateRequest } from "../service/validationEngine.js";
import { asyncLocalStorage } from "../index.js";
import { buildKey, CURRENT_MODE, OPERATIONS_REGISTRY } from "../registry/operationRegistry.js";
import { Api, Context } from "../database/Context.js";

export const createResponse = async (request: Request, response: Response) => {
  await asyncLocalStorage.run({ accessToken: request.header("x-amz-access-token") }, async () => {
    const result = await validateRequest(request);

    if (result.pass) {
      const compositeKey = buildKey(result.apiName, result.apiVersion, result.operationId);

      const operationHandler = OPERATIONS_REGISTRY.get(compositeKey);

      if (operationHandler) {
        if (!OPERATIONS_REGISTRY.isAllowedInCurrentMode(compositeKey)) {
          response
            .status(403)
            .json({
              errors: [{ code: "OperationNotAllowedForMode", message: `Operation ${result.operationId} is not available for ${CURRENT_MODE}.` }],
            })
            .send();
          return;
        }

        try {
          const operationContext = await operationHandler(result, request);

          if (operationContext.data.headers) response.setHeaders(operationContext.data.headers as Headers);
          if (operationContext.data.body) {
            response.status(operationContext.statusCode).json(operationContext.data.body).send();
          } else {
            response.status(operationContext.statusCode).send();
          }
        } catch (error) {
          console.error("Error in operation handler:", error);
          response.status(500).json({ errors: [{ code: "OperationProcessingFailure", message: "Operation processing failed" }] }).send();
        }
      } else {
        response.status(501).send();
      }
    } else {
      if (result.body) {
        response.status(result.statusCode).json(result.body).send();
      } else {
        response.status(result.statusCode).send();
      }
    }
  });
};

/**
 * Builds a handler that serves a stored document's raw content from a database
 * partition, keyed by the `:documentId` route param. Reports and Data Kiosk share
 * the same shape; they differ only in the partition and the default content-type
 * used when a record does not specify one.
 */
const makeDocumentDownloadHandler =
  (api: Api, defaultContentType: string) =>
  async (req: Request, res: Response): Promise<void> => {
    const doc = Context.instance.engine.get(api, req.params.documentId as string);
    if (doc?.content === undefined) {
      res.status(404).json({ errors: [{ code: "NotFound", message: "Document not found" }] });
      return;
    }
    res.setHeader("Content-Type", (doc.contentType as string) ?? defaultContentType);
    res.status(200).send(doc.content);
  };

export const downloadReportDocument = makeDocumentDownloadHandler(Api.REPORTS, "text/plain");
export const downloadDataKioskDocument = makeDocumentDownloadHandler(Api.DATA_KIOSK, "application/jsonl");
