import {
  searchOrdersSchema,
  getOrderSchema,
  cancelOrderSchema,
  updateShipmentStatusSchema,
  confirmShipmentSchema,
} from "../../src/zod-schemas/orders-schemas";

describe("Orders Schemas", () => {
  describe("searchOrdersSchema", () => {
    it("should validate valid search orders input", () => {
      const validInput = {
        createdAfter: "2025-01-01T00:00:00Z",
        marketplaceIds: ["ATVPDKIKX0DER"],
        fulfillmentStatuses: ["UNSHIPPED", "PARTIALLY_SHIPPED"],
        maxResultsPerPage: 50,
      };

      const result = searchOrdersSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should use default values", () => {
      const minimalInput = {
        createdAfter: "2025-01-01T00:00:00Z",
      };

      const result = searchOrdersSchema.parse(minimalInput);
      expect(result.marketplaceIds).toEqual(["ATVPDKIKX0DER"]);
      expect(result.maxResultsPerPage).toBe(50);
    });

    it("should reject invalid fulfillment status", () => {
      const invalidInput = {
        createdAfter: "2025-01-01T00:00:00Z",
        fulfillmentStatuses: ["INVALID_STATUS"],
      };

      const result = searchOrdersSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should reject maxResultsPerPage out of range", () => {
      const invalidInput = {
        createdAfter: "2025-01-01T00:00:00Z",
        maxResultsPerPage: 150,
      };

      const result = searchOrdersSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("getOrderSchema", () => {
    it("should validate valid get order input", () => {
      const validInput = {
        orderId: "123-4567890-1234567",
        includedData: ["BUYER", "RECIPIENT"],
      };

      const result = getOrderSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should require orderId", () => {
      const invalidInput = {
        includedData: ["BUYER"],
      };

      const result = getOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("cancelOrderSchema", () => {
    it("should validate valid cancel order input", () => {
      const validInput = {
        orderId: "123-4567890-1234567",
        cancelReasonCode: "NO_INVENTORY",
      };

      const result = cancelOrderSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should reject invalid cancel reason code", () => {
      const invalidInput = {
        orderId: "123-4567890-1234567",
        cancelReasonCode: "INVALID_REASON",
      };

      const result = cancelOrderSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it("should accept all valid cancel reason codes", () => {
      const validReasons = [
        "NO_INVENTORY",
        "BUYER_CANCELLED",
        "SHIPPING_ADDRESS_UNDELIVERABLE",
        "CUSTOMER_EXCHANGE",
        "PRICING_ERROR",
      ];

      validReasons.forEach((reason) => {
        const input = {
          orderId: "123-4567890-1234567",
          cancelReasonCode: reason,
        };
        const result = cancelOrderSchema.safeParse(input);
        expect(result.success).toBe(true);
      });
    });
  });

  describe("updateShipmentStatusSchema", () => {
    it("should validate valid update shipment status input", () => {
      const validInput = {
        orderId: "123-4567890-1234567",
        marketplaceId: "ATVPDKIKX0DER",
        shipmentStatus: "PickedUp",
      };

      const result = updateShipmentStatusSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should use default marketplace ID", () => {
      const input = {
        orderId: "123-4567890-1234567",
        shipmentStatus: "PickedUp",
      };

      const result = updateShipmentStatusSchema.parse(input);
      expect(result.marketplaceId).toBe("ATVPDKIKX0DER");
    });

    it("should reject invalid shipment status", () => {
      const invalidInput = {
        orderId: "123-4567890-1234567",
        shipmentStatus: "InvalidStatus",
      };

      const result = updateShipmentStatusSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });

  describe("confirmShipmentSchema", () => {
    it("should validate valid confirm shipment input", () => {
      const validInput = {
        orderId: "123-4567890-1234567",
        marketplaceId: "ATVPDKIKX0DER",
        packageDetail: {
          packageReferenceId: "PKG123",
          carrierCode: "UPS",
          shipDate: "2025-01-20T00:00:00Z",
        },
      };

      const result = confirmShipmentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should validate with optional shipFrom address", () => {
      const validInput = {
        orderId: "123-4567890-1234567",
        marketplaceId: "ATVPDKIKX0DER",
        packageDetail: {
          packageReferenceId: "PKG123",
          carrierCode: "UPS",
          shipDate: "2025-01-20T00:00:00Z",
          shipFrom: {
            name: "Test Warehouse",
            addressLine1: "123 Main St",
            city: "Seattle",
            stateOrRegion: "WA",
            postalCode: "98101",
            countryCode: "US",
            phone: "555-0100",
          },
        },
      };

      const result = confirmShipmentSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it("should require packageDetail fields", () => {
      const invalidInput = {
        orderId: "123-4567890-1234567",
        marketplaceId: "ATVPDKIKX0DER",
        packageDetail: {
          packageReferenceId: "PKG123",
          // Missing carrierCode and shipDate
        },
      };

      const result = confirmShipmentSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });
  });
});
