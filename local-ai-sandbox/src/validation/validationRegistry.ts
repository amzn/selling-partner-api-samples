import { ValidationPipeline } from "./validationTypes.js";
import { Api } from "../database/Context.js";

/**
 * Shared marketplace ID validation rule definition for query-sourced marketplaceIds (plural).
 */
const marketplaceIdsQueryRule = {
  checkType: "marketplaceIdValidation" as const,
  marketplaceIdsParam: { name: "marketplaceIds", source: "query" as const },
  failAction: {
    statusCode: 400,
    code: "InvalidInput",
    message: "One or more marketplace IDs are not valid for the configured region",
  },
};

/**
 * Listings Items `includedData` sections that belong to one selling partner
 * type only. Both selling partner types call the same operations, but the
 * datasets differ: `offers` and `fulfillmentAvailability` describe a merchant
 * offer, while `procurement` describes the cost Amazon pays a vendor. Asking
 * for the other type's dataset is rejected rather than answered empty, so the
 * caller learns the section does not apply to them.
 */
const listingsDatasetModeRules = [
  {
    checkType: "modeRestriction" as const,
    param: { name: "includedData", source: "query" as const },
    restrictedValue: "offers",
    requiredMode: "Seller",
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "The 'offers' includedData section is only available to sellers",
    },
  },
  {
    checkType: "modeRestriction" as const,
    param: { name: "includedData", source: "query" as const },
    restrictedValue: "fulfillmentAvailability",
    requiredMode: "Seller",
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "The 'fulfillmentAvailability' includedData section is only available to sellers",
    },
  },
  {
    checkType: "modeRestriction" as const,
    param: { name: "includedData", source: "query" as const },
    restrictedValue: "procurement",
    requiredMode: "Vendor",
    failAction: {
      statusCode: 400,
      code: "InvalidInput",
      message: "The 'procurement' includedData section is only available to vendors",
    },
  },
];

/**
 * Shared marketplace ID validation rule definition for body-sourced marketplaceIds (plural).
 */
const marketplaceIdsBodyRule = {
  checkType: "marketplaceIdValidation" as const,
  marketplaceIdsParam: { name: "marketplaceIds", source: "body" as const },
  failAction: {
    statusCode: 400,
    code: "InvalidInput",
    message: "One or more marketplace IDs are not valid for the configured region",
  },
};

/**
 * Shared marketplace ID validation rule definition for query-sourced marketplaceId (singular).
 */
const marketplaceIdQueryRule = {
  checkType: "marketplaceIdValidation" as const,
  marketplaceIdsParam: { name: "marketplaceId", source: "query" as const },
  failAction: {
    statusCode: 400,
    code: "InvalidInput",
    message: "The marketplace ID is not valid for the configured region",
  },
};


/**
 * Maps Validation_Key (apiName:apiVersion:operationId) to its corresponding ValidationPipeline.
 * Each pipeline is an ordered array of validation rules executed sequentially.
 * The first rule to fail short-circuits the pipeline and returns an error response.
 */
export const VALIDATION_REGISTRY = new Map<string, ValidationPipeline>([
  // --- Orders ---
  [
    "Orders:v0:confirmShipment",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
          entityLabel: "order",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Order not found",
        },
      },
      {
        checkType: "businessRule",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
        },
        condition: {
          field: "fulfillment.fulfilledBy",
          operator: "eq",
          value: "AMAZON",
        },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Confirm shipment not allowed for FBA orders",
        },
      },
      {
        checkType: "businessRule",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
        },
        condition: {
          field: "fulfillment.fulfillmentStatus",
          operator: "notIn",
          value: ["UNSHIPPED", "PARTIALLY_SHIPPED"],
        },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Confirm shipment is only allowed for orders with status UNSHIPPED or PARTIALLY_SHIPPED",
        },
      },
      {
        checkType: "orderItemExistence",
        entityLabel: "order",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Order item not found in the order",
        },
      },
      {
        checkType: "quantityLimit",
        entityLabel: "order",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Quantity exceeds the ordered quantity",
        },
      },
    ],
  ],
  [
    "Orders:2026-01-01:getOrder",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.ORDERS,
          paramName: "orderId",
          paramSource: "path",
          entityLabel: "order",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Order not found",
        },
      },
    ],
  ],
  [
    "Orders:2026-01-01:searchOrders",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "createdAfter", source: "query" },
          { name: "lastUpdatedAfter", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameters 'createdAfter' and 'lastUpdatedAfter' are mutually exclusive",
        },
      },
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "createdAfter", source: "query" },
          { name: "lastUpdatedAfter", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "At least one of 'createdAfter', 'lastUpdatedAfter' must be provided",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "createdAfter", source: "query" },
        secondOperand: { kind: "param", name: "createdBefore", source: "query" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'createdAfter' must be before or equal to 'createdBefore'",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "lastUpdatedAfter", source: "query" },
        secondOperand: { kind: "param", name: "lastUpdatedBefore", source: "query" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'lastUpdatedAfter' must be before or equal to 'lastUpdatedBefore'",
        },
      },
    ],
  ],

  // --- Listings ---
  [
    "Listings:2021-08-01:getListingsItem",
    [
      marketplaceIdsQueryRule,
      ...listingsDatasetModeRules,
      {
        checkType: "entityExistence",
        entity: {
          api: Api.LISTINGS,
          paramName: "sku",
          paramSource: "path",
          entityLabel: "listing",
          // A SKU is unique per seller, not globally, so a listing is keyed by
          // both. Resolving by SKU alone would return a different seller's
          // listing that happens to reuse the SKU.
          keyParams: [
            { name: "sellerId", source: "path" },
            { name: "sku", source: "path" },
          ],
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Listing not found",
        },
      },
    ],
  ],
  [
    // No existence rule: patchListingsItem is an upsert in production, so an
    // unknown SKU is created rather than rejected.
    "Listings:2021-08-01:patchListingsItem",
    [marketplaceIdsQueryRule],
  ],
  [
    "Listings:2021-08-01:deleteListingsItem",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "entityExistence",
        entity: {
          api: Api.LISTINGS,
          paramName: "sku",
          paramSource: "path",
          entityLabel: "listing",
          // Same composite key as the read: deleting by SKU alone would remove
          // whichever seller's listing happened to occupy that SKU.
          keyParams: [
            { name: "sellerId", source: "path" },
            { name: "sku", source: "path" },
          ],
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Listing not found",
        },
      },
    ],
  ],

  [
    "Listings:2021-08-01:putListingsItem",
    [
      marketplaceIdsQueryRule,
      // Offer-only submissions list against an ASIN a merchant does not own.
      // A vendor supplies the product itself, so the requirement set does not
      // apply to them.
      {
        checkType: "modeRestriction",
        param: { name: "requirements", source: "body" },
        restrictedValue: "LISTING_OFFER_ONLY",
        requiredMode: "Seller",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The 'LISTING_OFFER_ONLY' requirements value is only available to sellers",
        },
      },
    ],
  ],
  [
    "Listings:2021-08-01:searchListingsItems",
    [
      marketplaceIdsQueryRule,
      ...listingsDatasetModeRules,
      // identifiers and identifiersType are documented as required together.
      {
        checkType: "requiredTogether",
        params: [
          { name: "identifiers", source: "query" },
          { name: "identifiersType", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The 'identifiers' and 'identifiersType' parameters must be provided together",
        },
      },
      // These three filters cannot be combined with one another.
      {
        checkType: "atMostOneAllowed",
        params: [
          { name: "identifiers", source: "query" },
          { name: "variationParentSku", source: "query" },
          { name: "packageHierarchySku", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The 'identifiers', 'variationParentSku', and 'packageHierarchySku' parameters cannot be used together",
        },
      },
    ],
  ],

  // --- Catalog Items ---
  [
    "Catalog Items:2022-04-01:getCatalogItem",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "modeRestriction",
        param: { name: "includedData", source: "query" },
        restrictedValue: "vendorDetails",
        requiredMode: "Vendor",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The includedData requested requires vendor access",
        },
      },
      {
        checkType: "entityExistence",
        entity: {
          api: Api.CATALOG,
          paramName: "asin",
          paramSource: "path",
          entityLabel: "catalog item",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Catalog item not found",
        },
      },
    ],
  ],
  [
    "Catalog Items:2022-04-01:searchCatalogItems",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameters 'keywords' and 'identifiers' are mutually exclusive",
        },
      },
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "keywords", source: "query" },
          { name: "identifiers", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "At least one of 'keywords' or 'identifiers' must be provided",
        },
      },
      {
        checkType: "conditionalExclusion",
        trigger: { name: "identifiers", source: "query" },
        forbidden: [
          { name: "brandNames", source: "query" },
          { name: "classificationIds", source: "query" },
          { name: "keywordsLocale", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameters 'brandNames', 'classificationIds', and 'keywordsLocale' cannot be used when 'identifiers' is provided",
        },
      },
      {
        checkType: "conditionalRequirement",
        trigger: { name: "identifiers", source: "query" },
        required: { name: "identifiersType", source: "query" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'identifiersType' is required when 'identifiers' is provided",
        },
      },
      {
        checkType: "conditionalRequirement",
        trigger: { name: "identifiersType", source: "query", value: "SKU" },
        required: { name: "sellerId", source: "query" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'sellerId' is required when 'identifiersType' is 'SKU'",
        },
      },
      {
        checkType: "modeRestriction",
        param: { name: "includedData", source: "query" },
        restrictedValue: "vendorDetails",
        requiredMode: "Vendor",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The includedData requested requires vendor access",
        },
      },
    ],
  ],

  // --- External Fulfillment Shipments ---
  ["External Fulfillment Shipments:2024-09-11:getShipments", [
    marketplaceIdQueryRule
  ]],
  [
    "External Fulfillment Shipments:2024-09-11:getShipment",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:processShipment",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:createPackages",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:updatePackage",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        nested: {
          childParamName: "packageId",
          childParamSource: "path",
          childCollection: "packages",
          childIdField: "id",
          childLabel: "package",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment or package not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:updatePackageStatus",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        nested: {
          childParamName: "packageId",
          childParamSource: "path",
          childCollection: "packages",
          childIdField: "id",
          childLabel: "package",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment or package not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:retrieveShippingOptions",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:retrieveInvoice",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:generateInvoice",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],
  [
    "External Fulfillment Shipments:2024-09-11:generateShipLabels",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_SHIPMENTS,
          paramName: "shipmentId",
          paramSource: "path",
          entityLabel: "shipment",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Shipment not found",
        },
      },
    ],
  ],

  // --- External Fulfillment Inventory ---
  ["External Fulfillment Inventory:2024-09-11:batchInventory", [
    {
      checkType: "batchSizeLimit",
      arrayParam: { name: "requests", source: "body" },
      maxItems: 10,
      failAction: { statusCode: 400, code: "InvalidInput", message: "Batch size exceeds maximum of 10 items" },
    },
  ]],

  // --- External Fulfillment Returns ---
  [
    "External Fulfillment Returns:2024-09-11:listReturns",
    [
      {
        checkType: "conditionalRequirement",
        trigger: { name: "lastUpdatedSince", source: "query" },
        required: { name: "returnLocationId", source: "query" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'returnLocationId' is required when 'lastUpdatedSince' is provided" },
      },
      {
        checkType: "conditionalRequirement",
        trigger: { name: "lastUpdatedSince", source: "query" },
        required: { name: "status", source: "query" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'status' is required when 'lastUpdatedSince' is provided" },
      },
      {
        checkType: "conditionalRequirement",
        trigger: { name: "lastUpdatedUntil", source: "query" },
        required: { name: "returnLocationId", source: "query" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'returnLocationId' is required when 'lastUpdatedUntil' is provided" },
      },
      {
        checkType: "conditionalRequirement",
        trigger: { name: "lastUpdatedUntil", source: "query" },
        required: { name: "status", source: "query" },
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'status' is required when 'lastUpdatedUntil' is provided" },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "createdSince", source: "query" },
        secondOperand: { kind: "param", name: "createdUntil", source: "query" },
        operator: "beforeOrEqual",
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'createdSince' must be before or equal to 'createdUntil'" },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "lastUpdatedSince", source: "query" },
        secondOperand: { kind: "param", name: "lastUpdatedUntil", source: "query" },
        operator: "beforeOrEqual",
        failAction: { statusCode: 400, code: "InvalidInput", message: "Parameter 'lastUpdatedSince' must be before or equal to 'lastUpdatedUntil'" },
      },
    ],
  ],
  [
    "External Fulfillment Returns:2024-09-11:getReturn",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.EXT_FULFILLMENT_RETURNS,
          paramName: "returnId",
          paramSource: "path",
          entityLabel: "return",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Return not found",
        },
      },
    ],
  ],

  // --- Reports ---
  [
    "Reports:2021-06-30:createReport",
    [
      marketplaceIdsBodyRule,
      {
        checkType: "reportTypeSupported",
        reportTypeParam: { name: "reportType", source: "body" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Unsupported reportType",
        },
      },
      {
        checkType: "reportMetaValidation",
        reportTypeParam: { name: "reportType", source: "body" },
        marketplaceIdsParam: { name: "marketplaceIds", source: "body" },
        reportOptionsParam: { name: "reportOptions", source: "body" },
        dataStartTimeParam: { name: "dataStartTime", source: "body" },
        dataEndTimeParam: { name: "dataEndTime", source: "body" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Report metadata validation failed",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "dataStartTime", source: "body" },
        secondOperand: { kind: "param", name: "dataEndTime", source: "body" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'dataStartTime' must be before or equal to 'dataEndTime'",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "dataStartTime", source: "body" },
        secondOperand: { kind: "now" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'dataStartTime' must be prior to or equal to the current date and time",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "dataEndTime", source: "body" },
        secondOperand: { kind: "now" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'dataEndTime' must be prior to or equal to the current date and time",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:getReport",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.REPORTS,
          paramName: "reportId",
          paramSource: "path",
          entityLabel: "report",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report not found",
        },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "report",
        field: "content",
        operator: "notExists",
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report not found",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:getReports",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "atLeastOneRequired",
        params: [
          { name: "reportTypes", source: "query" },
          { name: "nextToken", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "At least one of 'reportTypes' or 'nextToken' must be provided",
        },
      },
      {
        checkType: "conditionalExclusion",
        trigger: { name: "nextToken", source: "query" },
        forbidden: [
          { name: "reportTypes", source: "query" },
          { name: "processingStatuses", source: "query" },
          { name: "marketplaceIds", source: "query" },
          { name: "pageSize", source: "query" },
          { name: "createdSince", source: "query" },
          { name: "createdUntil", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "When 'nextToken' is provided, no other parameters may be specified",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "createdSince", source: "query" },
        secondOperand: { kind: "param", name: "createdUntil", source: "query" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'createdSince' must be before or equal to 'createdUntil'",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:cancelReport",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.REPORTS,
          paramName: "reportId",
          paramSource: "path",
          entityLabel: "report",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report not found",
        },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "report",
        field: "content",
        operator: "notExists",
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report not found",
        },
      },
      {
        checkType: "businessRule",
        entity: {
          api: Api.REPORTS,
          paramName: "reportId",
          paramSource: "path",
        },
        condition: {
          field: "processingStatus",
          operator: "neq",
          value: "IN_QUEUE",
        },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Only reports with processingStatus 'IN_QUEUE' can be cancelled",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:getReportDocument",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.REPORTS,
          paramName: "reportDocumentId",
          paramSource: "path",
          entityLabel: "report document",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report document not found",
        },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "report document",
        field: "content",
        operator: "exists",
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report document not found",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:createReportSchedule",
    [
      marketplaceIdsBodyRule,
      {
        checkType: "reportSchedulable",
        reportTypeParam: { name: "reportType", source: "body" },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "reportType can only be requested, not scheduled",
        },
      },
      {
        checkType: "dateComparison",
        firstOperand: { name: "nextReportCreationTime", source: "body" },
        secondOperand: { kind: "now" },
        operator: "afterOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'nextReportCreationTime' must be in the future",
        },
      },
    ],
  ],
  [
    "Reports:2021-06-30:getReportSchedule",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.REPORTS,
          paramName: "reportScheduleId",
          paramSource: "path",
          entityLabel: "report schedule",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report schedule not found",
        },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "report schedule",
        field: "reportScheduleId",
        operator: "exists",
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report schedule not found",
        },
      },
    ],
  ],
  ["Reports:2021-06-30:getReportSchedules", []],
  [
    "Reports:2021-06-30:cancelReportSchedule",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.REPORTS,
          paramName: "reportScheduleId",
          paramSource: "path",
          entityLabel: "report schedule",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report schedule not found",
        },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "report schedule",
        field: "reportScheduleId",
        operator: "exists",
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Report schedule not found",
        },
      },
    ],
  ],

  // --- Product Type Definitions ---
  [
    "Product Type Definitions:2020-09-01:searchDefinitionsProductTypes",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "mutualExclusivity",
        params: [
          { name: "keywords", source: "query" },
          { name: "itemName", source: "query" },
        ],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameters 'keywords' and 'itemName' are mutually exclusive",
        },
      },
    ],
  ],
  [
    "Product Type Definitions:2020-09-01:getDefinitionsProductType",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "entityExistence",
        entity: {
          api: Api.PRODUCT_TYPE_DEFINITIONS,
          paramName: "productType",
          paramSource: "path",
          entityLabel: "product type definition",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Product type definition not found",
        },
      },
    ],
  ],

  // --- Listings Restrictions ---
  [
    "Listings Restrictions:2021-08-01:getListingsRestrictions",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "atLeastOneRequired",
        params: [{ name: "marketplaceIds", source: "query" }],
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "At least one 'marketplaceIds' value must be provided",
        },
      },
    ],
  ],

  // --- Product Pricing ---
  ["Product Pricing:2022-05-01:getCompetitiveSummary", [
      {
        checkType: "arrayItemFieldValue",
        arrayParam: { name: "requests", source: "body" },
        itemField: "uri",
        expectedValue: "/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Each request uri must be '/products/pricing/2022-05-01/offer/featuredOfferExpectedPrice'",
        },
      },
    ]],
  [
    "Product Pricing:2022-05-01:getFeaturedOfferExpectedPriceBatch",
    [
      {
        checkType: "batchSizeLimit",
        arrayParam: { name: "requests", source: "body" },
        maxItems: 40,
        failAction: { statusCode: 400, code: "InvalidInput", message: "Batch size exceeds maximum of 40 items" },
      },
    ],
  ],

  // --- FBA Inventory ---
  [
    "FBA Inventory:v1:getInventorySummaries",
    [
      marketplaceIdsQueryRule,
      {
        checkType: "dateComparison",
        firstOperand: { name: "startDateTime", source: "query" },
        secondOperand: { kind: "now", offsetMs: -(18 * 30 * 24 * 60 * 60 * 1000) },
        operator: "afterOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "startDateTime must be no earlier than 18 months prior to the current date and time",
        },
      },
    ],
  ],

  // --- Notifications ---
  ["Notifications:v1:getDestinations", []],
  ["Notifications:v1:getSubscription", []],
  ["Notifications:v1:getSubscriptions", []],
  ["Notifications:v1:createDestination", []],
  [
    "Notifications:v1:getDestination",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.NOTIFICATIONS,
          paramName: "destinationId",
          paramSource: "path",
          entityLabel: "destination",
          // Destinations and subscriptions share the Api.NOTIFICATIONS
          // keyspace (each keyed by its own UUID), so a subscriptionId
          // passed here must not resolve as a destination.
          expectedType: "destination",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Destination not found",
        },
      },
    ],
  ],
  [
    "Notifications:v1:deleteDestination",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.NOTIFICATIONS,
          paramName: "destinationId",
          paramSource: "path",
          entityLabel: "destination",
          expectedType: "destination",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Destination not found",
        },
      },
    ],
  ],
  [
    "Notifications:v1:createSubscription",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.NOTIFICATIONS,
          paramName: "destinationId",
          paramSource: "body",
          entityLabel: "destination",
          // Reject a subscriptionId supplied as destinationId in the body.
          expectedType: "destination",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Destination not found",
        },
      },
    ],
  ],
  [
    "Notifications:v1:getSubscriptionById",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.NOTIFICATIONS,
          paramName: "subscriptionId",
          paramSource: "path",
          entityLabel: "subscription",
          // Reject a destinationId passed as subscriptionId.
          expectedType: "subscription",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Subscription not found",
        },
      },
    ],
  ],
  [
    "Notifications:v1:deleteSubscriptionById",
    [
      {
        checkType: "entityExistence",
        entity: {
          api: Api.NOTIFICATIONS,
          paramName: "subscriptionId",
          paramSource: "path",
          entityLabel: "subscription",
          expectedType: "subscription",
        },
        failAction: {
          statusCode: 404,
          code: "NotFound",
          message: "Subscription not found",
        },
      },
    ],
  ],

  // --- Data Kiosk ---
  [
    "Data Kiosk:2023-11-15:createQuery",
    [
      {
        checkType: "stringLengthLimit",
        param: { name: "query", source: "body" },
        max: 8000,
        normalizeWhitespace: true,
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "The query must be at most 8000 characters after unnecessary whitespace is removed.",
        },
      },
    ],
  ],
  [
    "Data Kiosk:2023-11-15:getQueries",
    [
      {
        checkType: "dateComparison",
        firstOperand: { name: "createdSince", source: "query" },
        secondOperand: { kind: "param", name: "createdUntil", source: "query" },
        operator: "beforeOrEqual",
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Parameter 'createdSince' must be before or equal to 'createdUntil'",
        },
      },
    ],
  ],
  [
    "Data Kiosk:2023-11-15:getQuery",
    [
      {
        checkType: "entityExistence",
        entity: { api: Api.DATA_KIOSK, paramName: "queryId", paramSource: "path", entityLabel: "query" },
        failAction: { statusCode: 404, code: "NotFound", message: "Query not found" },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "query",
        field: "content",
        operator: "notExists",
        failAction: { statusCode: 404, code: "NotFound", message: "Query not found" },
      },
    ],
  ],
  [
    "Data Kiosk:2023-11-15:cancelQuery",
    [
      {
        checkType: "entityExistence",
        entity: { api: Api.DATA_KIOSK, paramName: "queryId", paramSource: "path", entityLabel: "query" },
        failAction: { statusCode: 404, code: "NotFound", message: "Query not found" },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "query",
        field: "content",
        operator: "notExists",
        failAction: { statusCode: 404, code: "NotFound", message: "Query not found" },
      },
      {
        checkType: "businessRule",
        entity: { api: Api.DATA_KIOSK, paramName: "queryId", paramSource: "path" },
        condition: { field: "processingStatus", operator: "in", value: ["DONE", "FATAL"] },
        failAction: {
          statusCode: 400,
          code: "InvalidInput",
          message: "Only queries with a non-terminal processingStatus (IN_QUEUE, IN_PROGRESS) can be cancelled",
        },
      },
    ],
  ],
  [
    "Data Kiosk:2023-11-15:getDocument",
    [
      {
        checkType: "entityExistence",
        entity: { api: Api.DATA_KIOSK, paramName: "documentId", paramSource: "path", entityLabel: "document" },
        failAction: { statusCode: 404, code: "NotFound", message: "Document not found" },
      },
      {
        checkType: "entityFieldCheck",
        entityLabel: "document",
        field: "content",
        operator: "exists",
        failAction: { statusCode: 404, code: "NotFound", message: "Document not found" },
      },
    ],
  ],
]);