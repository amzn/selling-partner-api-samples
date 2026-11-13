import { identifyApiModel } from "./apiSchemaIdentificationService.js";
import Enforcer from "openapi-enforcer";
import { Request } from "express";

export const validateRequest = async (request: Request) => {
  const model = identifyApiModel(request.path);

  if (model) {
    const openapiEnforcer = await Enforcer("./res/models/" + model, {
      componentOptions: {
        // ignore "example" properties
        exceptionSkipCodes: ["WSCH006"],
      },
    });

    let result;
    if (["GET", "DELETE"].includes(request.method)) {
      result = openapiEnforcer.request({
        method: request.method,
        path: request.path,
        query: Object.assign({}, request.query),
        headers: Object.assign({}, request.headers),
      });
    } else {
      result = openapiEnforcer.request({
        method: request.method,
        path: request.path,
        body: Object.assign({}, request.body),
        query: Object.assign({}, request.query),
        headers: Object.assign({}, request.headers),
      });
    }

    const [value, error] = result;

    if (value) {
      return { valid: true, operationId: value.operation.operationId, result: value };
    } else {
      return { valid: false, statusCode: 400, errors: { errors: error.toString().replace(/\s+/g, " ").trim() } };
    }
  } else return { valid: false, statusCode: 404, errors: undefined };
};
