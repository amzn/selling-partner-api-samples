import { SPAPIAuth } from "../../auth/sp-api-auth.js";
import { credentialStore } from "../../auth/credential-store.js";

// Type Definitions
export interface SPAPIConfig {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  baseUrl?: string;
}

export interface SearchOrdersArgs {
  createdAfter?: string;
  createdBefore?: string;
  lastUpdatedAfter?: string;
  lastUpdatedBefore?: string;
  fulfillmentStatuses?: Array<
    | "PENDING"
    | "UNSHIPPED"
    | "PARTIALLY_SHIPPED"
    | "SHIPPED"
    | "CANCELLED"
    | "UNFULFILLABLE"
  >;
  marketplaceIds?: string[];
  fulfilledBy?: Array<"AMAZON" | "MERCHANT">;
  maxResultsPerPage?: number;
  includedData?: Array<
    | "BUYER"
    | "RECIPIENT"
    | "PROCEEDS"
    | "EXPENSE"
    | "PROMOTION"
    | "CANCELLATION"
    | "FULFILLMENT"
    | "PACKAGES"
  >;
  paginationToken?: string;
}

export interface GetOrderArgs {
  orderId: string;
  includedData?: Array<
    | "BUYER"
    | "RECIPIENT"
    | "PROCEEDS"
    | "EXPENSE"
    | "PROMOTION"
    | "CANCELLATION"
    | "FULFILLMENT"
    | "PACKAGES"
  >;
}

export interface CancelOrderArgs {
  orderId: string;
  cancelReasonCode:
    | "NO_INVENTORY"
    | "BUYER_CANCELLED"
    | "SHIPPING_ADDRESS_UNDELIVERABLE"
    | "CUSTOMER_EXCHANGE"
    | "PRICING_ERROR";
}

export interface UpdateShipmentStatusArgs {
  orderId: string;
  marketplaceId: string;
  shipmentStatus: "ReadyForPickup" | "PickedUp" | "RefusedPickup";
  orderItems?: Array<{
    orderItemId?: string;
    quantity?: number;
  }>;
}

export interface UpdateVerificationStatusArgs {
  orderId: string;
  marketplaceId: string;
  regulatedOrderVerificationStatus: {
    status: "Approved" | "Rejected" | "Expired" | "Cancelled";
    validUntil?: string;
    rejectionReason?: {
      rejectionReasonId: string;
      rejectionReasonDescription: string;
    };
  };
}

export interface ConfirmShipmentArgs {
  orderId: string;
  marketplaceId: string;
  packageDetail: {
    packageReferenceId: string;
    carrierCode: string;
    shippingMethod?: string;
    trackingNumber?: string;
    shipDate: string;
    carrierName?: string;
    shipFrom?: {
      name: string;
      addressLine1: string;
      addressLine2?: string;
      addressLine3?: string;
      city: string;
      county?: string;
      district?: string;
      stateOrRegion: string;
      postalCode: string;
      countryCode: string;
      phone: string;
    };
  };
  codCollectionMethod?: "DirectPayment";
}

export interface GetOrderRegulatedInfoArgs {
  orderId: string;
}

export interface ToolResponse {
  content: Array<{
    type: "text";
    text: string;
    meta?: Record<string, unknown>;
  }>;
  isError?: boolean;
  [key: string]: unknown;
}

export class OrdersApiTool {
  private getAuth(): SPAPIAuth | null {
    const storeCredentials = credentialStore.getCredentials();
    if (credentialStore.isConfigured()) {
      return new SPAPIAuth({
        clientId: storeCredentials.clientId,
        clientSecret: storeCredentials.clientSecret,
        refreshToken: storeCredentials.refreshToken,
        baseUrl: storeCredentials.baseUrl,
      });
    }
    return null;
  }

  private getBaseUrl(): string {
    const storeCredentials = credentialStore.getCredentials();
    return (
      storeCredentials.baseUrl || "https://sellingpartnerapi-na.amazon.com"
    );
  }

  private checkCredentials(): ToolResponse | null {
    if (!credentialStore.isConfigured()) {
      return {
        content: [
          {
            type: "text",
            text: `❌ **SP-API Credentials Required**

To use this tool, you need to configure SP-API credentials first.

**Option 1: Use the configure_credentials tool**
\`\`\`
Configure my SP-API credentials:
- Client ID: amzn1.application-oa2-client.xxx
- Client Secret: your_secret
- Refresh Token: Atzr|xxx
- Region: na
\`\`\`

**Option 2: Set environment variables**
\`\`\`bash
export SP_API_CLIENT_ID="your_client_id"
export SP_API_CLIENT_SECRET="your_client_secret"
export SP_API_REFRESH_TOKEN="your_refresh_token"
\`\`\`

**Note:** The migration assistant tool does not require credentials.`,
          },
        ],
        isError: true,
      };
    }
    return null;
  }

  async searchOrders(args: SearchOrdersArgs): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const {
      createdAfter,
      createdBefore,
      lastUpdatedAfter,
      lastUpdatedBefore,
      fulfillmentStatuses,
      marketplaceIds = ["ATVPDKIKX0DER"],
      fulfilledBy,
      maxResultsPerPage = 50,
      includedData = [],
      paginationToken,
    } = args;

    if (!createdAfter && !lastUpdatedAfter) {
      return {
        content: [
          {
            type: "text",
            text: "Error: Either createdAfter or lastUpdatedAfter must be provided",
          },
        ],
        isError: true,
      };
    }

    const queryParams: Record<string, string> = {
      marketplaceIds: marketplaceIds.join(","),
      maxResultsPerPage: maxResultsPerPage.toString(),
    };

    if (createdAfter) queryParams.createdAfter = createdAfter;
    if (createdBefore) queryParams.createdBefore = createdBefore;
    if (lastUpdatedAfter) queryParams.lastUpdatedAfter = lastUpdatedAfter;
    if (lastUpdatedBefore) queryParams.lastUpdatedBefore = lastUpdatedBefore;
    if (fulfillmentStatuses && fulfillmentStatuses.length > 0) {
      queryParams.fulfillmentStatuses = fulfillmentStatuses.join(",");
    }
    if (fulfilledBy && fulfilledBy.length > 0) {
      queryParams.fulfilledBy = fulfilledBy.join(",");
    }
    if (includedData.length > 0) {
      queryParams.includedData = includedData.join(",");
    }
    if (paginationToken) {
      queryParams.paginationToken = paginationToken;
    }

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "GET",
        `${this.getBaseUrl()}/orders/2026-01-01/orders`,
        queryParams,
      );

      return {
        content: [
          {
            type: "text",
            text: this.formatOrdersResponse(response.data),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getOrder(args: GetOrderArgs): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId, includedData = [] } = args;

    const queryParams: Record<string, string> = {};
    if (includedData.length > 0) {
      queryParams.includedData = includedData.join(",");
    }

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "GET",
        `${this.getBaseUrl()}/orders/2026-01-01/orders/${orderId}`,
        queryParams,
      );

      return {
        content: [
          {
            type: "text",
            text: this.formatOrderResponse(response.data.order),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async cancelOrder(args: CancelOrderArgs): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId, cancelReasonCode } = args;

    try {
      const auth = this.getAuth()!;
      await auth.makeAuthenticatedRequest(
        "PUT",
        `${this.getBaseUrl()}/orders/2026-01-01/orders/${orderId}/cancellation`,
        {},
        { cancelReasonCode },
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Order cancellation request accepted for order ${orderId}. The cancellation process is underway.`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // V0 APIs
  async updateShipmentStatus(
    args: UpdateShipmentStatusArgs,
  ): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId, marketplaceId, shipmentStatus, orderItems } = args;

    const requestBody: any = {
      marketplaceId,
      shipmentStatus,
    };

    if (orderItems && orderItems.length > 0) {
      requestBody.orderItems = orderItems;
    }

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "POST",
        `${this.getBaseUrl()}/orders/v0/orders/${orderId}/shipment`,
        {},
        requestBody,
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Shipment status updated successfully for order ${orderId}.\n\nResponse: ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating shipment status: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async updateVerificationStatus(
    args: UpdateVerificationStatusArgs,
  ): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId, marketplaceId, regulatedOrderVerificationStatus } = args;

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "PATCH",
        `${this.getBaseUrl()}/orders/v0/orders/${orderId}/regulatedInfo`,
        {},
        { marketplaceId, regulatedOrderVerificationStatus },
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Verification status updated successfully for order ${orderId}.\n\nResponse: ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error updating verification status: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async confirmShipment(args: ConfirmShipmentArgs): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId, marketplaceId, packageDetail, codCollectionMethod } = args;

    const requestBody: any = { marketplaceId, packageDetail };
    if (codCollectionMethod) {
      requestBody.codCollectionMethod = codCollectionMethod;
    }

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "POST",
        `${this.getBaseUrl()}/orders/v0/orders/${orderId}/shipmentConfirmation`,
        {},
        requestBody,
      );

      return {
        content: [
          {
            type: "text",
            text: `✅ Shipment confirmed successfully for order ${orderId}.\n\nResponse: ${JSON.stringify(response.data, null, 2)}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error confirming shipment: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getOrderRegulatedInfo(
    args: GetOrderRegulatedInfoArgs,
  ): Promise<ToolResponse> {
    const credentialError = this.checkCredentials();
    if (credentialError) return credentialError;

    const { orderId } = args;

    try {
      const auth = this.getAuth()!;
      const response = await auth.makeAuthenticatedRequest(
        "GET",
        `${this.getBaseUrl()}/orders/v0/orders/${orderId}/regulatedInfo`,
        {},
      );

      return {
        content: [
          {
            type: "text",
            text: this.formatRegulatedInfoResponse(response.data),
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error getting regulated info: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  private formatOrdersResponse(data: any): string {
    if (!data.orders || data.orders.length === 0) {
      return "No orders found matching the criteria.";
    }

    let result = `📦 Found ${data.orders.length} orders:\n\n`;
    result += "=".repeat(50) + "\n\n";

    data.orders.forEach((order: any, index: number) => {
      result += `**Order ${index + 1}**\n`;
      result += `Order ID: ${order.orderId}\n`;
      result += `Created: ${new Date(order.createdTime).toLocaleDateString()}\n`;
      result += `Status: ${order.fulfillment?.fulfillmentStatus || "Unknown"}\n`;
      result += `Marketplace: ${order.salesChannel?.marketplaceName || "N/A"}\n`;

      if (order.buyer) {
        result += `Buyer: ${order.buyer.buyerName || "N/A"}\n`;
      }

      if (order.recipient?.deliveryAddress) {
        const addr = order.recipient.deliveryAddress;
        result += `Shipping: ${addr.addressLine1 || ""}, ${addr.city || ""}, ${addr.stateOrRegion || ""} ${addr.postalCode || ""}\n`;
      }

      if (order.orderItems && order.orderItems.length > 0) {
        result += `Items: ${order.orderItems.length} item(s)\n`;
        order.orderItems.forEach((item: any, itemIndex: number) => {
          const price = item.product?.price?.unitPrice;
          const priceStr = price
            ? `${price.amount} ${price.currencyCode}`
            : "N/A";
          result += `  ${itemIndex + 1}. ${item.product?.title || "Unknown"} (Qty: ${item.quantityOrdered}, Price: ${priceStr})\n`;
        });
      }

      result += "\n" + "-".repeat(40) + "\n\n";
    });

    if (data.pagination?.nextToken) {
      result += `\n🔗 **Next page available** - Use paginationToken: ${data.pagination.nextToken}`;
    }

    return result;
  }

  private formatOrderResponse(order: any): string {
    let result = `📋 **Order Details**\n\n`;
    result += "=".repeat(50) + "\n\n";

    result += `**Basic Information**\n`;
    result += `Order ID: ${order.orderId}\n`;
    result += `Created: ${new Date(order.createdTime).toLocaleString()}\n`;
    result += `Last Updated: ${new Date(order.lastUpdatedTime).toLocaleString()}\n`;
    result += `Marketplace: ${order.salesChannel?.marketplaceName || "N/A"}\n`;
    result += `Channel: ${order.salesChannel?.channelName || "N/A"}\n`;

    if (order.programs && order.programs.length > 0) {
      result += `Programs: ${order.programs.join(", ")}\n`;
    }

    if (order.buyer) {
      result += `\n**Buyer Information**\n`;
      result += `Name: ${order.buyer.buyerName || "N/A"}\n`;
      result += `Email: ${order.buyer.buyerEmail || "N/A"}\n`;
      if (order.buyer.buyerCompanyName) {
        result += `Company: ${order.buyer.buyerCompanyName}\n`;
      }
      if (order.buyer.buyerPurchaseOrderNumber) {
        result += `PO Number: ${order.buyer.buyerPurchaseOrderNumber}\n`;
      }
    }

    if (order.recipient?.deliveryAddress) {
      result += `\n**Shipping Address**\n`;
      const addr = order.recipient.deliveryAddress;
      result += `Name: ${addr.name || "N/A"}\n`;
      if (addr.companyName) result += `Company: ${addr.companyName}\n`;
      result += `Address: ${addr.addressLine1 || ""}\n`;
      if (addr.addressLine2) result += `         ${addr.addressLine2}\n`;
      if (addr.addressLine3) result += `         ${addr.addressLine3}\n`;
      result += `City: ${addr.city || "N/A"}\n`;
      result += `State/Region: ${addr.stateOrRegion || "N/A"}\n`;
      result += `Postal Code: ${addr.postalCode || "N/A"}\n`;
      result += `Country: ${addr.countryCode || "N/A"}\n`;
      if (addr.phone) result += `Phone: ${addr.phone}\n`;
      result += `Address Type: ${addr.addressType || "N/A"}\n`;
    }

    if (order.fulfillment) {
      result += `\n**Fulfillment Information**\n`;
      result += `Status: ${order.fulfillment.fulfillmentStatus}\n`;
      result += `Fulfilled By: ${order.fulfillment.fulfilledBy}\n`;
      if (order.fulfillment.fulfillmentServiceLevel) {
        result += `Service Level: ${order.fulfillment.fulfillmentServiceLevel}\n`;
      }
    }

    if (order.orderItems && order.orderItems.length > 0) {
      result += `\n**Order Items (${order.orderItems.length})**\n\n`;
      order.orderItems.forEach((item: any, index: number) => {
        result += `**${index + 1}. ${item.product?.title || "Unknown Product"}**\n`;
        result += `   Order Item ID: ${item.orderItemId}\n`;
        result += `   ASIN: ${item.product?.asin || "N/A"}\n`;
        result += `   SKU: ${item.product?.sellerSku || "N/A"}\n`;
        result += `   Quantity Ordered: ${item.quantityOrdered}\n`;

        if (item.product?.price?.unitPrice) {
          const price = item.product.price.unitPrice;
          result += `   Unit Price: ${price.amount} ${price.currencyCode}\n`;
        }

        if (item.fulfillment) {
          result += `   Fulfilled: ${item.fulfillment.quantityFulfilled || 0}\n`;
          result += `   Unfulfilled: ${item.fulfillment.quantityUnfulfilled || 0}\n`;
        }

        result += "\n";
      });
    }

    return result;
  }

  private formatRegulatedInfoResponse(data: any): string {
    if (!data) {
      return "No regulated information found for this order.";
    }

    let result = `📋 **Regulated Order Information**\n\n`;
    result += "=".repeat(50) + "\n\n";

    if (data.regulatedInformation) {
      const info = data.regulatedInformation;

      if (info.verificationStatus) {
        result += `**Verification Status**\n`;
        result += `Status: ${info.verificationStatus.status}\n`;
        if (info.verificationStatus.validUntil) {
          result += `Valid Until: ${new Date(info.verificationStatus.validUntil).toLocaleString()}\n`;
        }
        if (info.verificationStatus.rejectionReason) {
          result += `Rejection Reason: ${info.verificationStatus.rejectionReason.rejectionReasonDescription}\n`;
        }
        result += "\n";
      }

      if (info.regulatedOrderItems && info.regulatedOrderItems.length > 0) {
        result += `**Regulated Items (${info.regulatedOrderItems.length})**\n\n`;
        info.regulatedOrderItems.forEach((item: any, index: number) => {
          result += `**${index + 1}. ${item.title || "Unknown Item"}**\n`;
          result += `   Order Item ID: ${item.orderItemId}\n`;
          result += `   ASIN: ${item.asin}\n`;
          result += `   Quantity Ordered: ${item.quantityOrdered}\n`;
          if (item.verificationStatus) {
            result += `   Verification Status: ${item.verificationStatus.status}\n`;
          }
          if (item.fulfillmentInstructions) {
            result += `   Fulfillment Instructions:\n`;
            if (item.fulfillmentInstructions.fulfillmentInstructionsType) {
              result += `      Type: ${item.fulfillmentInstructions.fulfillmentInstructionsType}\n`;
            }
            if (item.fulfillmentInstructions.fulfillmentInstructionsText) {
              result += `      Text: ${item.fulfillmentInstructions.fulfillmentInstructionsText}\n`;
            }
          }
          result += "\n";
        });
      }
    }

    if (data.errors && data.errors.length > 0) {
      result += `**Errors**\n`;
      data.errors.forEach((error: any) => {
        result += `- Code: ${error.code}, Message: ${error.message}\n`;
      });
    }

    return result;
  }
}
