import { z } from "zod";
import { Api } from "../database/Context.js";

// --- Request Context ---

export interface RequestContext {
  apiName: string;
  apiVersion: string;
  operationId: string;
  method: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string | string[] | undefined>;
  body: Record<string, unknown> | undefined;
}

// --- Validation Results ---

export interface ValidationPass {
  pass: true;
  resolvedEntities: Record<string, Record<string, unknown>>;
}

export interface ValidationFail {
  pass: false;
  statusCode: number;
  body: {
    errors: {
      code: string;
      message: string;
      details?: string;
    }[];
  };
}

export type ValidationResult = ValidationPass | ValidationFail;

// --- Unified Validation Results (for unified entry point) ---

export interface UnifiedValidationPass {
  pass: true;
  operationId: string;
  apiName: string;
  apiVersion: string;
  pathParams: Record<string, string>;
  queryParams: Record<string, string | string[] | undefined>;
  body: Record<string, unknown> | undefined;
  resolvedEntities: Record<string, Record<string, unknown>>;
  operation: any; // Full OpenAPI operation object from openapi-enforcer
}

export interface UnifiedValidationFail {
  pass: false;
  statusCode: number;
  body?: { errors: { code: string; message: string; details?: string }[] };
}

export type UnifiedValidationResult = UnifiedValidationPass | UnifiedValidationFail;

// --- Validation Rule Interfaces ---

export interface BaseValidationRule {
  checkType: string;
  failAction: {
    statusCode: number;
    code?: string;
    message: string;
    details?: string;
  };
}

export interface EntityExistenceRule extends BaseValidationRule {
  checkType: "entityExistence";
  entity: {
    api: Api;
    paramName: string;
    paramSource: "path" | "query" | "body";
    entityLabel: string;
    /**
     * Params forming a composite primary key, in key order, for partitions
     * whose records are only unique within a scope (a listing's SKU is unique
     * per seller, not globally). When omitted, `paramName` alone is the key.
     * `paramName` still names the identifier reported in a not-found message,
     * so the composite key format never leaks to callers.
     */
    keyParams?: { name: string; source: "path" | "query" | "body" }[];
    /**
     * Required `_type` discriminator for partitions that store more than one
     * record shape under the same keyspace (e.g. Notifications destinations
     * and subscriptions both live in Api.NOTIFICATIONS, keyed by their own
     * UUID). When set, a record found by key whose `_type` does not match is
     * treated the same as not found, so a subscriptionId cannot resolve as a
     * destination (or vice versa). Omit for partitions with a single record
     * shape.
     */
    expectedType?: string;
  };
  nested?: {
    childParamName: string;
    childParamSource: "path" | "query" | "body";
    childCollection: string;
    childIdField: string;
    childLabel: string;
  };
}

export interface MutualExclusivityRule extends BaseValidationRule {
  checkType: "mutualExclusivity";
  params: {
    name: string;
    source: "path" | "query" | "body";
  }[];
}

/**
 * At most one of the params may be present. Unlike mutualExclusivity, all of
 * them being absent is valid — for groups of optional, conflicting filters.
 */
export interface AtMostOneAllowedRule extends BaseValidationRule {
  checkType: "atMostOneAllowed";
  params: { name: string; source: "path" | "query" | "body" }[];
}

/**
 * The params must be supplied together: either all present or all absent.
 */
export interface RequiredTogetherRule extends BaseValidationRule {
  checkType: "requiredTogether";
  params: { name: string; source: "path" | "query" | "body" }[];
}

export interface AtLeastOneRequiredRule extends BaseValidationRule {
  checkType: "atLeastOneRequired";
  params: {
    name: string;
    source: "path" | "query" | "body";
  }[];
}

export interface ConditionalExclusionRule extends BaseValidationRule {
  checkType: "conditionalExclusion";
  trigger: {
    name: string;
    source: "path" | "query" | "body";
  };
  forbidden: {
    name: string;
    source: "path" | "query" | "body";
  }[];
}

export interface BusinessRuleCheck extends BaseValidationRule {
  checkType: "businessRule";
  entity: {
    api: Api;
    paramName: string;
    paramSource: "path" | "query" | "body";
  };
  condition: {
    field: string;
    operator: "eq" | "neq" | "in" | "notIn";
    value: unknown;
  };
}

export interface DateComparisonRule extends BaseValidationRule {
  checkType: "dateComparison";
  firstOperand: {
    name: string;
    source: "path" | "query" | "body";
  };
  secondOperand: { kind: "param"; name: string; source: "path" | "query" | "body" } | { kind: "now"; offsetMs?: number };
  operator: "before" | "after" | "beforeOrEqual" | "afterOrEqual";
}

export interface OrderItemExistenceRule extends BaseValidationRule {
  checkType: "orderItemExistence";
  entityLabel: string;
}

export interface QuantityLimitRule extends BaseValidationRule {
  checkType: "quantityLimit";
  entityLabel: string;
}

export interface ReportTypeSupportedRule extends BaseValidationRule {
  checkType: "reportTypeSupported";
  reportTypeParam: {
    name: string;
    source: "path" | "query" | "body";
  };
}

export interface ReportMetaValidationRule extends BaseValidationRule {
  checkType: "reportMetaValidation";
  reportTypeParam: {
    name: string;
    source: "path" | "query" | "body";
  };
  marketplaceIdsParam: {
    name: string;
    source: "path" | "query" | "body";
  };
  reportOptionsParam: {
    name: string;
    source: "path" | "query" | "body";
  };
  dataStartTimeParam: {
    name: string;
    source: "path" | "query" | "body";
  };
  dataEndTimeParam: {
    name: string;
    source: "path" | "query" | "body";
  };
}

export interface EntityFieldCheckRule extends BaseValidationRule {
  checkType: "entityFieldCheck";
  entityLabel: string;
  field: string;
  operator: "exists" | "notExists";
}

export interface ReportSchedulableRule extends BaseValidationRule {
  checkType: "reportSchedulable";
  reportTypeParam: {
    name: string;
    source: "path" | "query" | "body";
  };
}

export interface MarketplaceIdValidationRule extends BaseValidationRule {
  checkType: "marketplaceIdValidation";
  marketplaceIdsParam: {
    name: string;
    source: "path" | "query" | "body";
  };
}

export interface ConditionalRequirementRule extends BaseValidationRule {
  checkType: "conditionalRequirement";
  trigger: {
    name: string;
    source: "path" | "query" | "body";
    value?: unknown;
  };
  required: {
    name: string;
    source: "path" | "query" | "body";
  };
}

export interface ModeRestrictionRule extends BaseValidationRule {
  checkType: "modeRestriction";
  param: {
    name: string;
    source: "path" | "query" | "body";
  };
  restrictedValue: string;
  requiredMode: string;
}

export interface BatchSizeLimitRule extends BaseValidationRule {
  checkType: "batchSizeLimit";
  arrayParam: {
    name: string;
    source: "body";
    path?: string;
  };
  maxItems: number;
}

export interface ArrayItemFieldValueRule extends BaseValidationRule {
  checkType: "arrayItemFieldValue";
  arrayParam: {
    name: string;
    source: "body";
    path?: string;
  };
  itemField: string;
  expectedValue: string;
}

/**
 * Validates that a string parameter does not exceed a maximum length.
 * When `normalizeWhitespace` is true, insignificant whitespace is collapsed
 * (runs of whitespace → single space, trimmed) before measuring length —
 * matching SP-API "at most N characters after unnecessary whitespace is removed"
 * semantics. A missing/empty value passes (length checks are not presence checks).
 */
export interface StringLengthLimitRule extends BaseValidationRule {
  checkType: "stringLengthLimit";
  param: {
    name: string;
    source: "path" | "query" | "body";
  };
  max: number;
  normalizeWhitespace?: boolean;
}

// --- Discriminated Union and Pipeline ---

export type ValidationRule = EntityExistenceRule | MutualExclusivityRule | AtMostOneAllowedRule | RequiredTogetherRule | AtLeastOneRequiredRule | ConditionalExclusionRule | BusinessRuleCheck | DateComparisonRule | OrderItemExistenceRule | QuantityLimitRule | ReportTypeSupportedRule | ReportMetaValidationRule | EntityFieldCheckRule | ReportSchedulableRule | MarketplaceIdValidationRule | ConditionalRequirementRule | ModeRestrictionRule | BatchSizeLimitRule | ArrayItemFieldValueRule | StringLengthLimitRule;

export type ValidationPipeline = ValidationRule[];

// --- Rule Handler Type ---

export type RuleHandler = (rule: ValidationRule, context: RequestContext, resolvedEntities: Record<string, Record<string, unknown>>) => Promise<ValidationResult>;

// --- Zod Schemas for Runtime Validation ---

export const ParamRefSchema = z.object({
  name: z.string(),
  source: z.enum(["path", "query", "body"]),
});

export const FailActionSchema = z.object({
  statusCode: z.number().int().min(400).max(599),
  code: z.string().optional(),
  message: z.string(),
  details: z.string().optional(),
});

export const EntityExistenceRuleSchema = z.object({
  checkType: z.literal("entityExistence"),
  entity: z.object({
    api: z.nativeEnum(Api),
    paramName: z.string(),
    paramSource: z.enum(["path", "query", "body"]),
    entityLabel: z.string(),
    expectedType: z.string().optional(),
  }),
  nested: z
    .object({
      childParamName: z.string(),
      childParamSource: z.enum(["path", "query", "body"]),
      childCollection: z.string(),
      childIdField: z.string(),
      childLabel: z.string(),
    })
    .optional(),
  failAction: FailActionSchema,
});

export const MutualExclusivityRuleSchema = z.object({
  checkType: z.literal("mutualExclusivity"),
  params: z.array(ParamRefSchema).min(2),
  failAction: FailActionSchema,
});

export const AtMostOneAllowedRuleSchema = z.object({
  checkType: z.literal("atMostOneAllowed"),
  params: z.array(ParamRefSchema).min(2),
  failAction: FailActionSchema,
});

export const RequiredTogetherRuleSchema = z.object({
  checkType: z.literal("requiredTogether"),
  params: z.array(ParamRefSchema).min(2),
  failAction: FailActionSchema,
});

export const AtLeastOneRequiredRuleSchema = z.object({
  checkType: z.literal("atLeastOneRequired"),
  params: z.array(ParamRefSchema).min(1),
  failAction: FailActionSchema,
});

export const ConditionalExclusionRuleSchema = z.object({
  checkType: z.literal("conditionalExclusion"),
  trigger: ParamRefSchema,
  forbidden: z.array(ParamRefSchema).min(1),
  failAction: FailActionSchema,
});

export const BusinessRuleCheckSchema = z.object({
  checkType: z.literal("businessRule"),
  entity: z.object({
    api: z.nativeEnum(Api),
    paramName: z.string(),
    paramSource: z.enum(["path", "query", "body"]),
  }),
  condition: z.object({
    field: z.string(),
    operator: z.enum(["eq", "neq", "in", "notIn"]),
    value: z.unknown(),
  }),
  failAction: FailActionSchema,
});

export const DateComparisonRuleSchema = z.object({
  checkType: z.literal("dateComparison"),
  firstOperand: ParamRefSchema,
  secondOperand: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("param"), name: z.string(), source: z.enum(["path", "query", "body"]) }),
    z.object({ kind: z.literal("now"), offsetMs: z.number().optional() }),
  ]),
  operator: z.enum(["before", "after", "beforeOrEqual", "afterOrEqual"]),
  failAction: FailActionSchema,
});

export const OrderItemExistenceRuleSchema = z.object({
  checkType: z.literal("orderItemExistence"),
  entityLabel: z.string(),
  failAction: FailActionSchema,
});

export const QuantityLimitRuleSchema = z.object({
  checkType: z.literal("quantityLimit"),
  entityLabel: z.string(),
  failAction: FailActionSchema,
});

export const ReportTypeSupportedRuleSchema = z.object({
  checkType: z.literal("reportTypeSupported"),
  reportTypeParam: ParamRefSchema,
  failAction: FailActionSchema,
});

export const ReportMetaValidationRuleSchema = z.object({
  checkType: z.literal("reportMetaValidation"),
  reportTypeParam: ParamRefSchema,
  marketplaceIdsParam: ParamRefSchema,
  reportOptionsParam: ParamRefSchema,
  dataStartTimeParam: ParamRefSchema,
  dataEndTimeParam: ParamRefSchema,
  failAction: FailActionSchema,
});

export const EntityFieldCheckRuleSchema = z.object({
  checkType: z.literal("entityFieldCheck"),
  entityLabel: z.string(),
  field: z.string(),
  operator: z.enum(["exists", "notExists"]),
  failAction: FailActionSchema,
});

export const ReportSchedulableRuleSchema = z.object({
  checkType: z.literal("reportSchedulable"),
  reportTypeParam: ParamRefSchema,
  failAction: FailActionSchema,
});

export const MarketplaceIdValidationRuleSchema = z.object({
  checkType: z.literal("marketplaceIdValidation"),
  marketplaceIdsParam: ParamRefSchema,
  failAction: FailActionSchema,
});

export const ConditionalRequirementRuleSchema = z.object({
  checkType: z.literal("conditionalRequirement"),
  trigger: z.object({
    name: z.string(),
    source: z.enum(["path", "query", "body"]),
    value: z.unknown().optional(),
  }),
  required: ParamRefSchema,
  failAction: FailActionSchema,
});

export const ModeRestrictionRuleSchema = z.object({
  checkType: z.literal("modeRestriction"),
  param: ParamRefSchema,
  restrictedValue: z.string(),
  requiredMode: z.string(),
  failAction: FailActionSchema,
});

export const BatchSizeLimitRuleSchema = z.object({
  checkType: z.literal("batchSizeLimit"),
  arrayParam: z.object({
    name: z.string(),
    source: z.literal("body"),
    path: z.string().optional(),
  }),
  maxItems: z.number().int().min(1),
  failAction: FailActionSchema,
});

export const ArrayItemFieldValueRuleSchema = z.object({
  checkType: z.literal("arrayItemFieldValue"),
  arrayParam: z.object({
    name: z.string(),
    source: z.literal("body"),
    path: z.string().optional(),
  }),
  itemField: z.string(),
  expectedValue: z.string(),
  failAction: FailActionSchema,
});

export const StringLengthLimitRuleSchema = z.object({
  checkType: z.literal("stringLengthLimit"),
  param: z.object({
    name: z.string(),
    source: z.enum(["path", "query", "body"]),
  }),
  max: z.number().int().min(0),
  normalizeWhitespace: z.boolean().optional(),
  failAction: FailActionSchema,
});

export const ValidationRuleSchema = z.discriminatedUnion("checkType", [
  EntityExistenceRuleSchema,
  MutualExclusivityRuleSchema,
  AtMostOneAllowedRuleSchema,
  RequiredTogetherRuleSchema,
  AtLeastOneRequiredRuleSchema,
  ConditionalExclusionRuleSchema,
  BusinessRuleCheckSchema,
  DateComparisonRuleSchema,
  OrderItemExistenceRuleSchema,
  QuantityLimitRuleSchema,
  ReportTypeSupportedRuleSchema,
  ReportMetaValidationRuleSchema,
  EntityFieldCheckRuleSchema,
  ReportSchedulableRuleSchema,
  MarketplaceIdValidationRuleSchema,
  ConditionalRequirementRuleSchema,
  ModeRestrictionRuleSchema,
  BatchSizeLimitRuleSchema,
  ArrayItemFieldValueRuleSchema,
  StringLengthLimitRuleSchema,
]);
