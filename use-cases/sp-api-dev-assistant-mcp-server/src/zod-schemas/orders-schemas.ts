/**
 * Zod schemas for Orders API tools
 */

import { z } from "zod";

// Orders API V1 Schemas
export const searchOrdersSchema = z.object({
  createdAfter: z
    .string()
    .optional()
    .describe(
      "ISO 8601 date for orders created after this time (e.g., '2025-10-01T00:00:00Z')",
    ),
  createdBefore: z
    .string()
    .optional()
    .describe("ISO 8601 date for orders created before this time"),
  lastUpdatedAfter: z
    .string()
    .optional()
    .describe("ISO 8601 date for orders last updated after this time"),
  lastUpdatedBefore: z
    .string()
    .optional()
    .describe("ISO 8601 date for orders last updated before this time"),
  fulfillmentStatuses: z
    .array(
      z.enum([
        "PENDING",
        "UNSHIPPED",
        "PARTIALLY_SHIPPED",
        "SHIPPED",
        "CANCELLED",
        "UNFULFILLABLE",
      ]),
    )
    .optional()
    .describe("Filter by fulfillment status"),
  marketplaceIds: z
    .array(z.string())
    .default(["ATVPDKIKX0DER"])
    .describe("Marketplace IDs to search in (e.g., ['ATVPDKIKX0DER' for US])"),
  fulfilledBy: z
    .array(z.enum(["AMAZON", "MERCHANT"]))
    .optional()
    .describe("Filter by fulfillment channel"),
  maxResultsPerPage: z
    .number()
    .min(1)
    .max(100)
    .default(50)
    .describe("Number of results per page (1-100)"),
  includedData: z
    .array(
      z.enum([
        "BUYER",
        "RECIPIENT",
        "PROCEEDS",
        "EXPENSE",
        "PROMOTION",
        "CANCELLATION",
        "FULFILLMENT",
        "PACKAGES",
      ]),
    )
    .optional()
    .describe("Data sets to include in response"),
  paginationToken: z
    .string()
    .optional()
    .describe("Token for pagination from previous response"),
});

export const getOrderSchema = z.object({
  orderId: z.string().describe("Amazon order ID (e.g., '123-4567890-1234567')"),
  includedData: z
    .array(
      z.enum([
        "BUYER",
        "RECIPIENT",
        "PROCEEDS",
        "EXPENSE",
        "PROMOTION",
        "CANCELLATION",
        "FULFILLMENT",
        "PACKAGES",
      ]),
    )
    .optional()
    .describe("Data sets to include in response"),
});

export const cancelOrderSchema = z.object({
  orderId: z.string().describe("Amazon order ID to cancel"),
  cancelReasonCode: z
    .enum([
      "NO_INVENTORY",
      "BUYER_CANCELLED",
      "SHIPPING_ADDRESS_UNDELIVERABLE",
      "CUSTOMER_EXCHANGE",
      "PRICING_ERROR",
    ])
    .describe("Reason for cancellation"),
});

// Orders API V0 Schemas
export const updateShipmentStatusSchema = z.object({
  orderId: z.string().describe("Amazon order ID"),
  marketplaceId: z
    .string()
    .default("ATVPDKIKX0DER")
    .describe("Marketplace ID (e.g., 'ATVPDKIKX0DER' for US)"),
  shipmentStatus: z
    .enum(["ReadyForPickup", "PickedUp", "RefusedPickup"])
    .describe("New shipment status"),
  orderItems: z
    .array(
      z.object({
        orderItemId: z.string().optional().describe("Order item ID"),
        quantity: z.number().optional().describe("Quantity"),
      }),
    )
    .optional()
    .describe("Optional order items to update"),
});

export const updateVerificationStatusSchema = z.object({
  orderId: z.string().describe("Amazon order ID"),
  marketplaceId: z
    .string()
    .default("ATVPDKIKX0DER")
    .describe("Marketplace ID (e.g., 'ATVPDKIKX0DER' for US)"),
  regulatedOrderVerificationStatus: z.object({
    status: z
      .enum(["Approved", "Rejected", "Expired", "Cancelled"])
      .describe("Verification status"),
    validUntil: z
      .string()
      .optional()
      .describe("ISO 8601 date when status is valid until"),
    rejectionReason: z
      .object({
        rejectionReasonId: z.string().describe("Rejection reason ID"),
        rejectionReasonDescription: z
          .string()
          .describe("Rejection reason description"),
      })
      .optional()
      .describe("Rejection reason (required if status is 'Rejected')"),
  }),
});

export const confirmShipmentSchema = z.object({
  orderId: z.string().describe("Amazon order ID"),
  marketplaceId: z
    .string()
    .default("ATVPDKIKX0DER")
    .describe("Marketplace ID (e.g., 'ATVPDKIKX0DER' for US)"),
  packageDetail: z.object({
    packageReferenceId: z.string().describe("Package reference ID"),
    carrierCode: z
      .string()
      .describe("Carrier code (e.g., 'UPS', 'FEDEX', 'USPS')"),
    shippingMethod: z.string().optional().describe("Shipping method"),
    trackingNumber: z.string().optional().describe("Tracking number"),
    shipDate: z
      .string()
      .describe("ISO 8601 ship date (e.g., '2025-10-01T00:00:00Z')"),
    carrierName: z.string().optional().describe("Carrier name"),
    shipFrom: z
      .object({
        name: z.string().describe("Sender name"),
        addressLine1: z.string().describe("Address line 1"),
        addressLine2: z.string().optional().describe("Address line 2"),
        addressLine3: z.string().optional().describe("Address line 3"),
        city: z.string().describe("City"),
        county: z.string().optional().describe("County"),
        district: z.string().optional().describe("District"),
        stateOrRegion: z.string().describe("State or region"),
        postalCode: z.string().describe("Postal code"),
        countryCode: z.string().describe("Country code (e.g., 'US')"),
        phone: z.string().describe("Phone number"),
      })
      .optional()
      .describe("Ship from address"),
  }),
  codCollectionMethod: z
    .enum(["DirectPayment"])
    .optional()
    .describe("Cash on delivery collection method"),
});

export const getOrderRegulatedInfoSchema = z.object({
  orderId: z.string().describe("Amazon order ID"),
});
