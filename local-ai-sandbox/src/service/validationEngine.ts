import {
  ArrayItemFieldValueRule,
  AtLeastOneRequiredRule,
  AtMostOneAllowedRule,
  BatchSizeLimitRule,
  BusinessRuleCheck,
  ConditionalExclusionRule,
  ConditionalRequirementRule,
  DateComparisonRule,
  EntityExistenceRule,
  EntityFieldCheckRule,
  MarketplaceIdValidationRule,
  ModeRestrictionRule,
  MutualExclusivityRule,
  OrderItemExistenceRule,
  QuantityLimitRule,
  ReportMetaValidationRule,
  ReportSchedulableRule,
  ReportTypeSupportedRule,
  RequestContext,
  RequiredTogetherRule,
  RuleHandler,
 StringLengthLimitRule, UnifiedValidationResult,
  ValidationFail,
  ValidationResult,
  ValidationRule,
} from "../validation/validationTypes.js";
import { VALIDATION_REGISTRY } from "../validation/validationRegistry.js";
import { Context } from "../database/Context.js";
import { buildEntityKey } from "../database/types.js";
import { identifyApiModel, identifyApiName, identifyApiVersion } from "./apiSchemaIdentificationService.js";
import { getAllowedMarketplaceIds } from "../marketplaceIds.js";
import Enforcer from "openapi-enforcer";
import { Request } from "express";
import { CURRENT_MODE } from "../registry/operationRegistry.js";
import { buildKey } from "../registry/operationRegistry.js";
import { REPORT_GENERATORS } from "./reportGeneratorService.js";
import { validateReport, REPORT_META } from "./reportValidationService.js";

// --- Schema Validation Stage Types ---

interface SchemaValidationSuccess {
  pass: true;
  operationId: string;
  apiName: string;
  apiVersion: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string | string[] | undefined>;
  operation: any;
}

interface SchemaValidationFailure {
  pass: false;
  statusCode: number;
  errors?: { errors: { code: string; message: string; details?: string }[] };
}

type SchemaValidationResult = SchemaValidationSuccess | SchemaValidationFailure;

/**
 * Internal function. Validates the raw request against the OpenAPI spec.
 * - Returns 404 (no body) if path doesn't match any known API model
 * - Returns 400 (with error details) if request violates the schema
 * - Returns success with extracted operationId, apiName, apiVersion, parsed params
 */
async function performSchemaValidation(request: Request): Promise<SchemaValidationResult> {
  const model = identifyApiModel(request.path);

  if (!model) {
    return { pass: false, statusCode: 404 };
  }

  const openapiEnforcer = await Enforcer("./res/models/" + model, {
    componentOptions: {
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
    const operation = value.operation;
    const operationId = operation.operationId as string;
    const pathParams = value.path as Record<string, string>;
    const queryParams = value.query as Record<string, string | string[] | undefined>;
    const apiName = identifyApiName(request.path) ?? "";
    const apiVersion = identifyApiVersion(request.path) ?? "";

    return { pass: true, operationId, apiName, apiVersion, pathParams, queryParams, operation };
  } else {
    return {
      pass: false,
      statusCode: 400,
      errors: {
        errors: [
          {
            code: "SchemaValidationError",
            message: error.toString().replace(/\s+/g, " ").trim(),
          },
        ],
      },
    };
  }
}

/**
 * Unified validation entry point. Performs:
 * 1. Schema_Validation_Stage (openapi-enforcer against SP-API OpenAPI specs)
 * 2. Validation_Key lookup (apiName:apiVersion:operationId)
 * 3. Pipeline rule execution (if pipeline registered)
 *
 * Returns either a pass result with all extracted context data, or a fail
 * result with HTTP status code and error body.
 */
export async function validateRequest(request: Request): Promise<UnifiedValidationResult> {
  const schemaResult = await performSchemaValidation(request);

  if (!schemaResult.pass) {
    return {
      pass: false,
      statusCode: schemaResult.statusCode,
      body: schemaResult.errors,
    };
  }

  const requestContext: RequestContext = {
    operationId: schemaResult.operationId,
    apiName: schemaResult.apiName,
    apiVersion: schemaResult.apiVersion,
    method: request.method,
    pathParams: schemaResult.pathParams,
    queryParams: schemaResult.queryParams,
    body: request.body as Record<string, unknown> | undefined,
  };

  const pipelineResult = await executeValidation(requestContext);

  if (!pipelineResult.pass) {
    return {
      pass: false,
      statusCode: pipelineResult.statusCode,
      body: pipelineResult.body,
    };
  }

  return {
    pass: true,
    operationId: schemaResult.operationId,
    apiName: schemaResult.apiName,
    apiVersion: schemaResult.apiVersion,
    pathParams: schemaResult.pathParams,
    queryParams: schemaResult.queryParams,
    body: request.body as Record<string, unknown> | undefined,
    resolvedEntities: pipelineResult.resolvedEntities,
    operation: schemaResult.operation,
  };
}

/**
 * Resolves a parameter value from the request context based on its name and source.
 * Returns the value if found, or undefined if absent — never throws.
 */
export function resolveParam(context: RequestContext, name: string, source: "path" | "query" | "body"): unknown {
  switch (source) {
    case "path":
      return Object.hasOwn(context.pathParams, name) ? context.pathParams[name] : undefined;
    case "query":
      return Object.hasOwn(context.queryParams, name) ? context.queryParams[name] : undefined;
    case "body":
      return context.body && Object.hasOwn(context.body, name) ? context.body[name] : undefined;
  }
}

/** True when a resolved parameter value counts as supplied by the caller. */
function isParamPresent(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/**
 * Internal registry of rule handlers keyed by check type identifier.
 * New rule types can be added via registerRuleHandler without modifying engine code.
 */
const ruleHandlers = new Map<string, RuleHandler>();

/**
 * Registers a handler function for a given check type.
 * This allows extending the validation engine with new rule types.
 */
export function registerRuleHandler(checkType: string, handler: RuleHandler): void {
  ruleHandlers.set(checkType, handler);
}

/**
 * Builds a ValidationFail result from a rule definition and optional custom message.
 * Uses failAction.code if specified, otherwise falls back to rule.checkType as the error code.
 */
export function buildFailResult(rule: ValidationRule, message?: string): ValidationFail {
  return {
    pass: false,
    statusCode: rule.failAction.statusCode,
    body: {
      errors: [
        {
          code: rule.failAction.code ?? rule.checkType,
          message: message ?? rule.failAction.message,
          ...(rule.failAction.details ? { details: rule.failAction.details } : {}),
        },
      ],
    },
  };
}

/**
 * Executes the validation pipeline for the given request context.
 *
 * 1. Builds a composite Validation_Key from apiName, apiVersion, and operationId.
 * 2. Looks up the pipeline by Validation_Key from the registry.
 * 3. If no pipeline is registered, returns a 400 failure indicating the operation has no validation pipeline.
 * 4. If the pipeline is empty, returns { pass: true }.
 * 5. Iterates rules in array-index order.
 * 6. For each rule, finds the corresponding handler in ruleHandlers and invokes it.
 * 7. If a rule fails, returns immediately (short-circuit).
 * 8. If all rules pass, returns { pass: true }.
 */
export async function executeValidation(context: RequestContext): Promise<ValidationResult> {
  const validationKey = buildKey(context.apiName, context.apiVersion, context.operationId);
  const pipeline = VALIDATION_REGISTRY.get(validationKey);

  if (!pipeline) {
    return {
      pass: false,
      statusCode: 501,
      body: {
        errors: [
          {
            code: "NoValidationPipeline",
            message: `No validation pipeline registered for '${validationKey}'`,
          },
        ],
      },
    };
  }

  if (pipeline.length === 0) {
    return { pass: true, resolvedEntities: {} };
  }

  const resolvedEntities: Record<string, Record<string, unknown>> = {};

  for (const rule of pipeline) {
    const handler = ruleHandlers.get(rule.checkType);
    if (!handler) {
      // If no handler is registered for this check type, skip the rule (pass)
      continue;
    }

    const result = await handler(rule, context, resolvedEntities);
    if (!result.pass) {
      return result;
    }

    // Merge any resolvedEntities from the handler's result into the accumulated map
    if (result.resolvedEntities) {
      for (const [key, value] of Object.entries(result.resolvedEntities)) {
        resolvedEntities[key] = value;
      }
    }
  }

  return { pass: true, resolvedEntities };
}

// --- entityExistence Rule Handler ---

/**
 * Key used to look the entity up: the single identifier param by default, or
 * `keyParams` joined in key order. Undefined when a key part is missing.
 */
function resolveEntityKey(rule: EntityExistenceRule, context: RequestContext, idValue: unknown): string | undefined {
  const keyParams = rule.entity.keyParams;
  if (!keyParams) return String(idValue);

  const parts: string[] = [];
  for (const param of keyParams) {
    const value = resolveParam(context, param.name, param.source);
    // Key parts come from the request line, so anything non-scalar means the
    // key cannot be formed and the entity cannot be resolved.
    if (typeof value !== "string" && typeof value !== "number") return undefined;
    const part = String(value);
    if (part === "") return undefined;
    parts.push(part);
  }
  return buildEntityKey(parts);
}

/**
 * Handler for the "entityExistence" check type. Resolves an entity by
 * `paramName`, or by the composite `keyParams` key; a `nested` rule then
 * searches the parent's child collection.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */
const entityExistenceHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as EntityExistenceRule;

  const idValue = resolveParam(context, typedRule.entity.paramName, typedRule.entity.paramSource);

  // If the entity ID is not provided, pass validation (don't fail if no ID given)
  if (idValue === undefined || idValue === null || idValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const entityKey = resolveEntityKey(typedRule, context, idValue);

  // Key-based lookup (the database stores entities keyed by their identifier)
  let parentEntity = entityKey === undefined ? null : Context.instance.engine.get(typedRule.entity.api, entityKey);

  // Some partitions store more than one record shape under the same keyspace
  // (e.g. Notifications destinations and subscriptions, both keyed by their
  // own UUID within Api.NOTIFICATIONS). If `expectedType` is set, a record
  // found under a different `_type` is treated as not found, so an ID that
  // belongs to the other record type never resolves here.
  if (parentEntity && typedRule.entity.expectedType !== undefined && (parentEntity as Record<string, unknown>)._type !== typedRule.entity.expectedType) {
    parentEntity = null;
  }

  if (!typedRule.nested) {
    // Flat lookup
    if (!parentEntity) {
      return buildFailResult(rule, `${typedRule.entity.entityLabel} with id '${String(idValue)}' not found`);
    }
    return { pass: true, resolvedEntities: { [typedRule.entity.entityLabel]: parentEntity } };
  }

  // Nested lookup: verify parent exists first
  if (!parentEntity) {
    return buildFailResult(rule, `${typedRule.entity.entityLabel} with id '${String(idValue)}' not found`);
  }

  // Parent exists — now look for child
  const childIdValue = resolveParam(context, typedRule.nested.childParamName, typedRule.nested.childParamSource);

  // If the child ID is not provided, pass validation
  if (childIdValue === undefined || childIdValue === null || childIdValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const childCollection = (parentEntity as Record<string, unknown>)[typedRule.nested.childCollection];

  if (!Array.isArray(childCollection)) {
    // If the child collection doesn't exist or isn't an array, child is not found
    return buildFailResult(rule, `${typedRule.nested.childLabel} with id '${String(childIdValue)}' not found`);
  }

  const childEntity = childCollection.find((child: Record<string, unknown>) => child[typedRule.nested!.childIdField] === childIdValue);

  if (!childEntity) {
    return buildFailResult(rule, `${typedRule.nested.childLabel} with id '${String(childIdValue)}' not found`);
  }

  return { pass: true, resolvedEntities: { [typedRule.entity.entityLabel]: parentEntity, [typedRule.nested.childLabel]: childEntity as Record<string, unknown> } };
};

registerRuleHandler("entityExistence", entityExistenceHandler);

// --- atLeastOneRequired Rule Handler ---

/**
 * Handler for the "atLeastOneRequired" check type.
 * Verifies that at least one parameter from the group is present and non-empty.
 * If none are present, returns HTTP 400 listing acceptable param names.
 *
 * Validates: Requirements 3.4, 3.5
 */
const atLeastOneRequiredHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as AtLeastOneRequiredRule;

  for (const param of typedRule.params) {
    const value = resolveParam(context, param.name, param.source);
    if (value !== undefined && value !== null && value !== "") {
      return { pass: true, resolvedEntities: {} };
    }
  }

  // None of the params are present and non-empty
  const paramNames = typedRule.params.map((p) => p.name).join("', '");
  return buildFailResult(rule, `At least one of '${paramNames}' must be provided`);
};

registerRuleHandler("atLeastOneRequired", atLeastOneRequiredHandler);

// --- mutualExclusivity Rule Handler ---

/**
 * Handles mutualExclusivity rules.
 * Verifies that exactly one parameter from the group is present and non-empty.
 * - If exactly one is present: pass
 * - If zero are present: fail with message listing all param names as required options
 * - If more than one are present: fail identifying the conflicting param names
 */
const mutualExclusivityHandler: RuleHandler = async (rule: ValidationRule, context: RequestContext, _resolvedEntities: Record<string, Record<string, unknown>>): Promise<ValidationResult> => {
  const mutualRule = rule as MutualExclusivityRule;

  const presentParams: string[] = [];

  for (const param of mutualRule.params) {
    const value = resolveParam(context, param.name, param.source);
    if (value !== undefined && value !== null && value !== "") {
      presentParams.push(param.name);
    }
  }

  if (presentParams.length === 1) {
    return { pass: true, resolvedEntities: {} };
  }

  if (presentParams.length === 0) {
    const paramNames = mutualRule.params.map((p) => p.name).join(", ");
    return buildFailResult(rule, `Exactly one of '${paramNames}' must be provided`);
  }

  // More than one present — conflicting
  const conflicting = presentParams.join(", ");
  return buildFailResult(rule, `Parameters '${conflicting}' are mutually exclusive`);
};

registerRuleHandler("mutualExclusivity", mutualExclusivityHandler);

// --- atMostOneAllowed Rule Handler ---

/**
 * Handler for the "atMostOneAllowed" check type.
 * Verifies that no more than one parameter from the group is present. Unlike
 * mutualExclusivity, none being present is valid — for groups of optional
 * filters that conflict with each other.
 */
const atMostOneAllowedHandler: RuleHandler = (rule: ValidationRule, context: RequestContext): Promise<ValidationResult> => {
  const typedRule = rule as AtMostOneAllowedRule;
  const present = typedRule.params.filter((param) => isParamPresent(resolveParam(context, param.name, param.source))).map((param) => param.name);

  if (present.length > 1) {
    return Promise.resolve(buildFailResult(rule, `Parameters '${present.join(", ")}' cannot be used together`));
  }
  return Promise.resolve({ pass: true, resolvedEntities: {} });
};

registerRuleHandler("atMostOneAllowed", atMostOneAllowedHandler);

// --- requiredTogether Rule Handler ---

/**
 * Handler for the "requiredTogether" check type.
 * Verifies the parameters are supplied as a set: either all present or all
 * absent. Reports the missing members when only some were provided.
 */
const requiredTogetherHandler: RuleHandler = (rule: ValidationRule, context: RequestContext): Promise<ValidationResult> => {
  const typedRule = rule as RequiredTogetherRule;
  const present: string[] = [];
  const missing: string[] = [];
  for (const param of typedRule.params) {
    if (isParamPresent(resolveParam(context, param.name, param.source))) present.push(param.name);
    else missing.push(param.name);
  }

  if (present.length > 0 && missing.length > 0) {
    return Promise.resolve(buildFailResult(rule, `Parameter(s) '${missing.join(", ")}' are required when '${present.join(", ")}' are provided`));
  }
  return Promise.resolve({ pass: true, resolvedEntities: {} });
};

registerRuleHandler("requiredTogether", requiredTogetherHandler);

// --- conditionalExclusion Rule Handler ---

/**
 * Handler for the "conditionalExclusion" check type.
 * Verifies that when a trigger parameter is present, none of the forbidden parameters are also present.
 * - If trigger is absent/empty: pass immediately
 * - If trigger is present and no forbidden params are present: pass
 * - If trigger is present and any forbidden param is present and non-empty: fail with HTTP 400
 *
 * Validates: Requirements 3.6, 3.7
 */
const conditionalExclusionHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ConditionalExclusionRule;

  const triggerValue = resolveParam(context, typedRule.trigger.name, typedRule.trigger.source);

  // If trigger is absent or empty, pass immediately
  if (triggerValue === undefined || triggerValue === null || triggerValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  // Trigger is present — check all forbidden params
  const presentForbidden: string[] = [];

  for (const forbidden of typedRule.forbidden) {
    const value = resolveParam(context, forbidden.name, forbidden.source);
    if (value !== undefined && value !== null && value !== "") {
      presentForbidden.push(forbidden.name);
    }
  }

  if (presentForbidden.length === 0) {
    return { pass: true, resolvedEntities: {} };
  }

  const forbiddenNames = presentForbidden.join("', '");
  return buildFailResult(rule, `Parameter '${forbiddenNames}' cannot be provided when '${typedRule.trigger.name}' is present`);
};

registerRuleHandler("conditionalExclusion", conditionalExclusionHandler);

// --- conditionalRequirement Rule Handler ---

/**
 * Handler for the "conditionalRequirement" check type.
 * When a trigger parameter is present (optionally matching a specific value),
 * a dependent parameter becomes required.
 *
 * - If trigger has a `value` field: only fires when trigger param equals that value
 * - If trigger has no `value` field: fires when trigger param is present (non-empty/non-null)
 * - When fired: checks if the required parameter is present; if absent/empty/null, returns fail
 * - When not fired: pass
 *
 * Validates: Requirements 2.6, 2.7
 */
const conditionalRequirementHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ConditionalRequirementRule;

  const triggerValue = resolveParam(context, typedRule.trigger.name, typedRule.trigger.source);

  // Determine if the trigger fires
  let triggerFired = false;

  if (typedRule.trigger.value !== undefined) {
    // Trigger has a specific value — only fire when trigger param equals that value
    triggerFired = triggerValue === typedRule.trigger.value;
  } else {
    // Trigger has no value — fire when trigger param is present (non-empty/non-null)
    triggerFired = triggerValue !== undefined && triggerValue !== null && triggerValue !== "";
  }

  if (!triggerFired) {
    return { pass: true, resolvedEntities: {} };
  }

  // Trigger fired — check if the required parameter is present
  const requiredValue = resolveParam(context, typedRule.required.name, typedRule.required.source);

  if (requiredValue === undefined || requiredValue === null || requiredValue === "") {
    return buildFailResult(rule);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("conditionalRequirement", conditionalRequirementHandler);

// --- businessRule Rule Handler ---

/**
 * Handler for the "businessRule" check type.
 * Retrieves an entity from the database and evaluates a condition against its field value.
 * If the condition is satisfied, the business constraint is violated and the rule fails.
 * If the entity is not found, the rule is skipped (passes).
 *
 * Before querying the database, checks if the entity is already available in resolvedEntities
 * from a prior entityExistence rule, avoiding redundant database queries.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 10.6
 */
const businessRuleHandler: RuleHandler = async (rule, context, resolvedEntities) => {
  const typedRule = rule as BusinessRuleCheck;

  // Resolve entity identifier from request context
  const identifier = resolveParam(context, typedRule.entity.paramName, typedRule.entity.paramSource);

  // If identifier is undefined/null/empty, skip evaluation
  if (identifier === undefined || identifier === null || identifier === "") {
    return { pass: true, resolvedEntities: {} };
  }

  // Try to find entity in resolvedEntities first (from prior entityExistence rules)
  let entity: unknown = undefined;
  for (const resolved of Object.values(resolvedEntities)) {
    if (resolved[typedRule.entity.paramName] === identifier) {
      entity = resolved;
      break;
    }
  }

  // Fall back to database query if not found in resolvedEntities
  if (!entity) {
    const key = identifier as string;
    const found = Context.instance.engine.get(typedRule.entity.api, key);

    // If entity not found, skip evaluation (Requirement 4.4)
    if (!found) {
      return { pass: true, resolvedEntities: {} };
    }

    entity = found;
  }

  // Extract field value using dot-notation path
  const fieldParts = typedRule.condition.field.split(".");
  let fieldValue: unknown = entity;
  for (const part of fieldParts) {
    if (fieldValue === undefined || fieldValue === null || typeof fieldValue !== "object") {
      fieldValue = undefined;
      break;
    }
    fieldValue = (fieldValue as Record<string, unknown>)[part];
  }

  // Evaluate condition based on operator
  const { operator, value } = typedRule.condition;
  let conditionSatisfied = false;

  switch (operator) {
    case "eq":
      conditionSatisfied = fieldValue === value;
      break;
    case "neq":
      conditionSatisfied = fieldValue !== value;
      break;
    case "in":
      conditionSatisfied = Array.isArray(value) && value.includes(fieldValue);
      break;
    case "notIn":
      conditionSatisfied = Array.isArray(value) && !value.includes(fieldValue);
      break;
  }

  // If condition is satisfied, the business constraint is violated
  if (conditionSatisfied) {
    return buildFailResult(rule);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("businessRule", businessRuleHandler);

// --- dateComparison Rule Handler ---

/**
 * Handler for the "dateComparison" check type.
 * Compares two date values extracted from the request context (or one date against "now")
 * using a relational operator (before, after, beforeOrEqual, afterOrEqual).
 *
 * - If the first operand is absent/empty: skip (pass)
 * - If the second operand is a param reference that is absent/empty: skip (pass)
 * - If either date string cannot be parsed as valid ISO 8601: return HTTP 400
 * - Otherwise: evaluate the operator and return pass/fail
 *
 * Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 */
const dateComparisonHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as DateComparisonRule;

  // Extract first operand value
  const firstValue = resolveParam(context, typedRule.firstOperand.name, typedRule.firstOperand.source);

  // If first operand is absent, skip the rule
  if (firstValue === undefined || firstValue === null || firstValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  // Determine the second date value
  let secondDateStr: string | undefined;
  let secondDate: Date;

  if (typedRule.secondOperand.kind === "now") {
    const offsetMs = (typedRule.secondOperand).offsetMs ?? 0;
    secondDate = new Date(Date.now() + offsetMs);
  } else {
    // kind === "param"
    const secondValue = resolveParam(context, typedRule.secondOperand.name, typedRule.secondOperand.source);

    // If second operand param is absent, skip the rule
    if (secondValue === undefined || secondValue === null || secondValue === "") {
      return { pass: true, resolvedEntities: {} };
    }

    secondDateStr = String(secondValue);
    secondDate = new Date(secondDateStr);

    // Validate second date is parseable
    if (isNaN(secondDate.getTime())) {
      return {
        pass: false,
        statusCode: 400,
        body: {
          errors: [
            {
              code: typedRule.failAction.code ?? typedRule.checkType,
              message: `Parameter '${typedRule.secondOperand.name}' contains an unparseable date value; expected ISO 8601 format`,
            },
          ],
        },
      };
    }
  }

  // Parse first date
  const firstDateStr = String(firstValue);
  const firstDate = new Date(firstDateStr);

  // Validate first date is parseable
  if (isNaN(firstDate.getTime())) {
    return {
      pass: false,
      statusCode: 400,
      body: {
        errors: [
          {
            code: typedRule.failAction.code ?? typedRule.checkType,
            message: `Parameter '${typedRule.firstOperand.name}' contains an unparseable date value; expected ISO 8601 format`,
          },
        ],
      },
    };
  }

  // Evaluate the comparison operator
  let comparisonPasses = false;

  switch (typedRule.operator) {
    case "before":
      comparisonPasses = firstDate < secondDate;
      break;
    case "after":
      comparisonPasses = firstDate > secondDate;
      break;
    case "beforeOrEqual":
      comparisonPasses = firstDate <= secondDate;
      break;
    case "afterOrEqual":
      comparisonPasses = firstDate >= secondDate;
      break;
  }

  if (comparisonPasses) {
    return { pass: true, resolvedEntities: {} };
  }

  // Comparison failed — return the failAction
  return buildFailResult(rule);
};

registerRuleHandler("dateComparison", dateComparisonHandler);

// --- orderItemExistence Rule Handler ---

/**
 * Handler for the "orderItemExistence" check type.
 * Iterates over `packageDetail.orderItems[]` in the request body and verifies each
 * `orderItemId` exists in the resolved order entity's `orderItems[]` array.
 *
 * Uses the resolved order entity from `resolvedEntities[entityLabel]` (resolved by
 * a prior entityExistence check) — no redundant database queries.
 *
 * Validates: Requirements 15.6
 */
const orderItemExistenceHandler: RuleHandler = async (rule, context, resolvedEntities) => {
  const typedRule = rule as OrderItemExistenceRule;

  // Get the resolved order entity
  const resolvedOrder = resolvedEntities[typedRule.entityLabel];
  if (!resolvedOrder) {
    return { pass: true, resolvedEntities: {} };
  }

  // Get orderItems from the request body's packageDetail
  const packageDetail = context.body?.packageDetail as Record<string, unknown> | undefined;
  if (!packageDetail) {
    return { pass: true, resolvedEntities: {} };
  }

  const requestOrderItems = packageDetail.orderItems as Record<string, unknown>[] | undefined;
  if (!Array.isArray(requestOrderItems) || requestOrderItems.length === 0) {
    return { pass: true, resolvedEntities: {} };
  }

  // Get the order's orderItems array
  const orderOrderItems = resolvedOrder.orderItems as Record<string, unknown>[] | undefined;
  if (!Array.isArray(orderOrderItems)) {
    // If the order has no orderItems, any request orderItemId will fail
    const firstItemId = requestOrderItems[0]?.orderItemId;
    return buildFailResult(rule, `Order item '${String(firstItemId)}' not found in the order`);
  }

  // Build a set of valid order item IDs for O(1) lookup
  const validOrderItemIds = new Set(orderOrderItems.map((item) => String(item.orderItemId)));

  // Check each request orderItemId
  for (const requestItem of requestOrderItems) {
    const orderItemId = requestItem.orderItemId;
    if (orderItemId === undefined || orderItemId === null) {
      continue;
    }
    if (!validOrderItemIds.has(String(orderItemId))) {
      return buildFailResult(rule, `Order item '${String(orderItemId)}' not found in the order`);
    }
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("orderItemExistence", orderItemExistenceHandler);

// --- quantityLimit Rule Handler ---

/**
 * Handler for the "quantityLimit" check type.
 * Iterates over `packageDetail.orderItems[]` in the request body and verifies each
 * `quantity` is ≤ the corresponding order item's `quantityOrdered` in the resolved order entity.
 *
 * Uses the resolved order entity from `resolvedEntities[entityLabel]` (resolved by
 * a prior entityExistence check) — no redundant database queries.
 *
 * Validates: Requirements 15.7
 */
const quantityLimitHandler: RuleHandler = async (rule, context, resolvedEntities) => {
  const typedRule = rule as QuantityLimitRule;

  // Get the resolved order entity
  const resolvedOrder = resolvedEntities[typedRule.entityLabel];
  if (!resolvedOrder) {
    return { pass: true, resolvedEntities: {} };
  }

  // Get orderItems from the request body's packageDetail
  const packageDetail = context.body?.packageDetail as Record<string, unknown> | undefined;
  if (!packageDetail) {
    return { pass: true, resolvedEntities: {} };
  }

  const requestOrderItems = packageDetail.orderItems as Record<string, unknown>[] | undefined;
  if (!Array.isArray(requestOrderItems) || requestOrderItems.length === 0) {
    return { pass: true, resolvedEntities: {} };
  }

  // Get the order's orderItems array
  const orderOrderItems = resolvedOrder.orderItems as Record<string, unknown>[] | undefined;
  if (!Array.isArray(orderOrderItems)) {
    return { pass: true, resolvedEntities: {} };
  }

  // Build a map of orderItemId → quantityOrdered for O(1) lookup
  const quantityByItemId = new Map<string, number>();
  for (const orderItem of orderOrderItems) {
    const itemId = String(orderItem.orderItemId);
    const quantityOrdered = orderItem.quantityOrdered as number;
    quantityByItemId.set(itemId, quantityOrdered);
  }

  // Check each request item's quantity against quantityOrdered
  for (const requestItem of requestOrderItems) {
    const orderItemId = requestItem.orderItemId;
    const quantity = requestItem.quantity as number;

    if (orderItemId === undefined || orderItemId === null || quantity === undefined || quantity === null) {
      continue;
    }

    const quantityOrdered = quantityByItemId.get(String(orderItemId));
    if (quantityOrdered === undefined) {
      // If the order item doesn't exist, skip (orderItemExistence handler handles this)
      continue;
    }

    if (quantity > quantityOrdered) {
      return buildFailResult(rule, `Quantity ${quantity} for order item '${String(orderItemId)}' exceeds the ordered quantity of ${quantityOrdered}`);
    }
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("quantityLimit", quantityLimitHandler);

// --- batchSizeLimit Rule Handler ---

/**
 * Handler for the "batchSizeLimit" check type.
 * Validates that an array in the request body does not exceed the configured maximum number of items.
 *
 * - If the value at the specified path is not an array: pass (schema validation handles type issues)
 * - If the array length exceeds maxItems: fail with the configured failAction
 * - Otherwise: pass
 *
 * Validates: Requirements 2.2
 */
const batchSizeLimitHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as BatchSizeLimitRule;

  // Resolve the array from the body using path (dot-notation) or top-level name
  let value: unknown;

  if (typedRule.arrayParam.path) {
    // Use dot-path to navigate into the body
    const parts = typedRule.arrayParam.path.split(".");
    value = context.body;
    for (const part of parts) {
      if (value === undefined || value === null || typeof value !== "object") {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
  } else {
    // Use name as a top-level key
    value = context.body?.[typedRule.arrayParam.name];
  }

  // If it's not an array, pass (schema validation handles missing/wrong types)
  if (!Array.isArray(value)) {
    return { pass: true, resolvedEntities: {} };
  }

  // Check if the array length exceeds maxItems
  if (value.length > typedRule.maxItems) {
    return buildFailResult(rule);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("batchSizeLimit", batchSizeLimitHandler);

// --- reportTypeSupported Rule Handler ---

/**
 * Handler for the "reportTypeSupported" check type.
 * Checks that the reportType specified in the request body is a supported report type
 * (i.e., has a registered generator in REPORT_GENERATORS).
 *
 * - If reportType is absent/empty: skip (pass)
 * - If reportType has a registered generator: pass
 * - If reportType has no registered generator: fail with HTTP 400
 */
const reportTypeSupportedHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ReportTypeSupportedRule;

  const reportType = resolveParam(context, typedRule.reportTypeParam.name, typedRule.reportTypeParam.source);

  if (reportType === undefined || reportType === null || reportType === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const generator = REPORT_GENERATORS[reportType as string];
  if (!generator) {
    return buildFailResult(rule, `Unsupported reportType: ${reportType as string}. Supported: ${Object.keys(REPORT_GENERATORS).join(", ")}`);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("reportTypeSupported", reportTypeSupportedHandler);

// --- reportMetaValidation Rule Handler ---

/**
 * Handler for the "reportMetaValidation" check type.
 * Validates the report request against report type metadata:
 * - Marketplace availability: checks marketplaceIds are valid for the report type
 * - Date range required: checks dataStartTime and dataEndTime are provided when required
 * - Report options: validates option keys and allowed values
 *
 * - If reportType is absent/empty: skip (pass)
 * - If reportType has no metadata: skip (pass)
 * - If validation fails: fail with HTTP 400 and descriptive message
 */
const reportMetaValidationHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ReportMetaValidationRule;

  const reportType = resolveParam(context, typedRule.reportTypeParam.name, typedRule.reportTypeParam.source);

  if (reportType === undefined || reportType === null || reportType === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const marketplaceIds = resolveParam(context, typedRule.marketplaceIdsParam.name, typedRule.marketplaceIdsParam.source) as string[] | undefined;
  const reportOptions = resolveParam(context, typedRule.reportOptionsParam.name, typedRule.reportOptionsParam.source) as Record<string, string> | undefined;
  const dataStartTime = resolveParam(context, typedRule.dataStartTimeParam.name, typedRule.dataStartTimeParam.source) as string | undefined;
  const dataEndTime = resolveParam(context, typedRule.dataEndTimeParam.name, typedRule.dataEndTimeParam.source) as string | undefined;

  const validationError = validateReport(reportType as string, marketplaceIds ?? [], reportOptions, dataStartTime, dataEndTime);

  if (validationError) {
    return buildFailResult(rule, validationError);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("reportMetaValidation", reportMetaValidationHandler);


// --- entityFieldCheck Rule Handler ---

/**
 * Handler for the "entityFieldCheck" check type.
 * Checks whether a field on a previously resolved entity exists or does not exist.
 *
 * - If the entity is not found in resolvedEntities: skip (pass)
 * - operator "exists": fails if the field is undefined
 * - operator "notExists": fails if the field is NOT undefined
 *
 * Used to distinguish between different record types stored in the same collection
 * (e.g., reports vs report documents in the REPORTS partition).
 */
const entityFieldCheckHandler: RuleHandler = async (rule, _context, resolvedEntities) => {
  const typedRule = rule as EntityFieldCheckRule;

  const entity = resolvedEntities[typedRule.entityLabel];
  if (!entity) {
    return { pass: true, resolvedEntities: {} };
  }

  const fieldValue = entity[typedRule.field];

  if (typedRule.operator === "exists") {
    if (fieldValue === undefined) {
      return buildFailResult(rule);
    }
  } else {
    // "notExists"
    if (fieldValue !== undefined) {
      return buildFailResult(rule);
    }
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("entityFieldCheck", entityFieldCheckHandler);

// --- reportSchedulable Rule Handler ---

/**
 * Handler for the "reportSchedulable" check type.
 * Checks that the specified report type is schedulable according to REPORT_META.
 *
 * - If reportType is absent/empty: skip (pass)
 * - If reportType has no metadata: skip (pass) — unknown types pass through
 * - If meta.schedulable is false: fail with HTTP 400
 * - Otherwise: pass
 */
const reportSchedulableHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ReportSchedulableRule;

  const reportType = resolveParam(context, typedRule.reportTypeParam.name, typedRule.reportTypeParam.source);

  if (reportType === undefined || reportType === null || reportType === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const meta = REPORT_META[reportType as string];
  if (meta && !meta.schedulable) {
    return buildFailResult(rule, `reportType ${reportType as string} can only be requested, not scheduled`);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("reportSchedulable", reportSchedulableHandler);

// --- marketplaceIdValidation Rule Handler ---

// Re-export for backward compatibility (consumers that import from this module)
export { MARKETPLACE_IDS_BY_REGION, getAllowedMarketplaceIds } from "../marketplaceIds.js";

/**
 * Handler for the "marketplaceIdValidation" check type.
 * Validates that the marketplaceId(s) provided in the request (query or body) are
 * within the allowed set for the configured REGION.
 *
 * Supports both single string and array-of-strings values.
 *
 * - If the param is absent/empty: skip (pass)
 * - If all marketplace IDs are in the allowed set: pass
 * - If any marketplace ID is not in the allowed set: fail with HTTP 400
 */
const marketplaceIdValidationHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as MarketplaceIdValidationRule;

  const rawValue = resolveParam(context, typedRule.marketplaceIdsParam.name, typedRule.marketplaceIdsParam.source);

  // If param is absent, skip validation
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  // Normalize to an array of strings
  const marketplaceIds: string[] = Array.isArray(rawValue) ? rawValue.map(String) : [String(rawValue)];

  if (marketplaceIds.length === 0) {
    return { pass: true, resolvedEntities: {} };
  }

  const allowed = getAllowedMarketplaceIds();
  const allowedSet = new Set(allowed);

  const invalid = marketplaceIds.filter((id) => !allowedSet.has(id));

  if (invalid.length > 0) {
    const region = process.env.REGION && ["NA", "EU", "FE"].includes(process.env.REGION) ? process.env.REGION : "NA";
    return buildFailResult(rule, `Invalid marketplace ID(s): ${invalid.join(", ")}. Allowed for region ${region}: ${allowed.join(", ")}`);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("marketplaceIdValidation", marketplaceIdValidationHandler);


// --- modeRestriction Rule Handler ---

/**
 * Handler for the "modeRestriction" check type.
 * When a parameter contains a restricted value, validates that the sandbox is running
 * in the required mode (checked via process.env.MODE).
 *
 * - If param is absent/empty: pass
 * - If param is an array: check if any element equals restrictedValue
 * - If param is a string: check if it equals restrictedValue
 * - If restricted value found and process.env.MODE does not match requiredMode: fail with HTTP 400
 * - Otherwise: pass
 *
 * Validates: Requirements 1.5, 2.8
 */
const modeRestrictionHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ModeRestrictionRule;

  const paramValue = resolveParam(context, typedRule.param.name, typedRule.param.source);

  // If param is absent/empty, skip validation
  if (paramValue === undefined || paramValue === null || paramValue === "") {
    return { pass: true, resolvedEntities: {} };
  }

  // Check if the restricted value is present
  let hasRestrictedValue = false;

  if (Array.isArray(paramValue)) {
    hasRestrictedValue = paramValue.some((element) => element === typedRule.restrictedValue);
  } else if (typeof paramValue === "string") {
    hasRestrictedValue = paramValue === typedRule.restrictedValue;
  }

  if (!hasRestrictedValue) {
    return { pass: true, resolvedEntities: {} };
  }

  // Restricted value found — check if current mode matches the required mode
  if (CURRENT_MODE !== typedRule.requiredMode) {
    return buildFailResult(rule);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("modeRestriction", modeRestrictionHandler);

// --- arrayItemFieldValue Rule Handler ---

/**
 * Handler for the "arrayItemFieldValue" check type.
 * Validates that every item in a body array has a specific field matching the expected value.
 *
 * - If the value at the specified path is not an array: pass (schema validation handles type issues)
 * - If any item's field does not match expectedValue: fail with the configured failAction
 * - Otherwise: pass
 */
const arrayItemFieldValueHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as ArrayItemFieldValueRule;

  // Resolve the array from the body using path (dot-notation) or top-level name
  let value: unknown;

  if (typedRule.arrayParam.path) {
    const parts = typedRule.arrayParam.path.split(".");
    value = context.body;
    for (const part of parts) {
      if (value === undefined || value === null || typeof value !== "object") {
        value = undefined;
        break;
      }
      value = (value as Record<string, unknown>)[part];
    }
  } else {
    value = context.body?.[typedRule.arrayParam.name];
  }

  // If it's not an array, pass (schema validation handles missing/wrong types)
  if (!Array.isArray(value)) {
    return { pass: true, resolvedEntities: {} };
  }

  // Check each item's field against the expected value
  for (const item of value) {
    if (typeof item !== "object" || item === null) {
      continue;
    }
    const fieldValue = (item as Record<string, unknown>)[typedRule.itemField];
    if (fieldValue !== typedRule.expectedValue) {
      return buildFailResult(rule);
    }
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("arrayItemFieldValue", arrayItemFieldValueHandler);

// --- stringLengthLimit Rule Handler ---

/**
 * Handler for the "stringLengthLimit" check type.
 * Fails when a string parameter's length exceeds `max`. When `normalizeWhitespace`
 * is true, runs of whitespace are collapsed to a single space and the value is
 * trimmed before measuring (SP-API "after unnecessary whitespace is removed").
 *
 * - If the value is absent/empty or not a string: skip (pass) — this is a length
 *   check, not a presence/type check (schema validation covers those).
 */
const stringLengthLimitHandler: RuleHandler = async (rule, context, _resolvedEntities) => {
  const typedRule = rule as StringLengthLimitRule;

  const value = resolveParam(context, typedRule.param.name, typedRule.param.source);
  if (typeof value !== "string" || value === "") {
    return { pass: true, resolvedEntities: {} };
  }

  const measured = typedRule.normalizeWhitespace ? value.replace(/\s+/g, " ").trim() : value;
  if (measured.length > typedRule.max) {
    return buildFailResult(rule);
  }

  return { pass: true, resolvedEntities: {} };
};

registerRuleHandler("stringLengthLimit", stringLengthLimitHandler);
