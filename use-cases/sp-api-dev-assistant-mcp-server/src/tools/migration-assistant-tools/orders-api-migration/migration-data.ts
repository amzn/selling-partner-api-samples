export interface MigrationData {
  deprecated: string[];
  notSupported: string[];
  mappingExamples: Record<string, string>;
  newFeatures: string[];
  apiMapping: Record<string, { v1: string; status: string; notes: string }>;
}

export function getOrdersApiMigrationData(): MigrationData {
  return {
    deprecated: [
      "OrderChannel",
      "ShipServiceLevel",
      "CbaDisplayableShippingLabel",
      "IsGlobalExpressEnabled",
      "PromiseResponseDueDate",
      "IsEstimatedShipDateSet",
      "IsSoldByAB",
      "BuyerInfo.BuyerCounty",
    ],
    notSupported: [
      "NumberOfItemsShipped",
      "NumberOfItemsUnshipped",
      "PaymentExecutionDetail",
      "PaymentMethod",
      "PaymentMethodDetails",
      "IsIBA",
      "HasRegulatedItems",
      "DefaultShipFromLocationAddress",
      "ElectronicInvoiceStatus",
      "BuyerInvoicePreference",
      "BuyerTaxInformation",
      "FulfillmentInstruction",
      "MarketplaceTaxInfo",
      "SellerDisplayName",
      "AutomatedShippingSettings",
      "BuyerInfo.BuyerTaxInfo",
      "ProductInfo",
      "ProductInfo.NumberOfItems",
      "TaxCollection",
      "TaxCollection.Model",
      "TaxCollection.ResponsibleParty",
      "DeemedResellerCategory",
      "StoreChainStoreId",
      "SerialNumberRequired",
      "AssociatedItems",
      "AssociatedItem.OrderId",
      "AssociatedItem.OrderItemId",
      "AssociatedItem.AssociationType",
      "PointsGrantedDetail.PointsNumber",
      "PointsGrantedDetail.PointsMonetaryValue",
      "ConditionId",
      "ConditionSubtypeId",
    ],
    mappingExamples: {
      AmazonOrderId: "Order.orderId",
      SellerOrderId: "Order.orderAliases (with aliasType == SELLER_ORDER_ID)",
      MarketplaceId: "Order.salesChannel.marketplaceId",
      PurchaseDate: "Order.createdTime",
      LastUpdateDate: "Order.lastUpdatedTime",
      OrderType: "Order.programs (check for PREORDER)",
      OrderStatus: "Order.fulfillment.fulfillmentStatus",
      FulfillmentChannel: "Order.fulfillment.fulfilledBy",
      SalesChannel: "Order.salesChannel.marketplaceName",
      ShipmentServiceLevelCategory: "Order.fulfillment.fulfillmentServiceLevel",
      OrderTotal: "Order.proceeds.grandTotal",
      EasyShipShipmentStatus: "Order.packages.packageStatus.detailedStatus",
      EarliestShipDate: "Order.fulfillment.shipByWindow.earliestDateTime",
      LatestShipDate: "Order.fulfillment.shipByWindow.latestDateTime",
      EarliestDeliveryDate:
        "Order.fulfillment.deliverByWindow.earliestDateTime",
      LatestDeliveryDate: "Order.fulfillment.deliverByWindow.latestDateTime",
      IsBusinessOrder: "Order.programs (check for AMAZON_BUSINESS)",
      IsPrime: "Order.programs (check for PRIME)",
      IsPremiumOrder: "Order.programs (check for PRIMIUM)",
      ReplacedOrderId:
        "Order.associatedOrders (with associationType == REPLACEMENT_ORIGINAL_ID or EXCHANGE_ORIGINAL_ID)",
      IsISPU: "Order.programs (check for IN_STORE_PICK_UP)",
      IsAccessPointOrder:
        "Order.recipient.deliveryAddress.addressType (check for PICKUP_POINT)",
      ShippingAddress: "Order.recipient.deliveryAddress",
      "BuyerInfo.BuyerEmail": "Order.buyer.buyerEmail",
      "BuyerInfo.BuyerName": "Order.buyer.buyerName",
      "BuyerInfo.PurchaseOrderNumber": "Order.buyer.buyerPurchaseOrderNumber",
      BuyerCompanyName: "Order.buyer.buyerCompanyName",
      DeliveryPreferences: "Order.recipient.deliveryPreference",
      ASIN: "Order.orderItems.product.asin",
      SellerSKU: "Order.orderItems.product.sellerSku",
      OrderItemId: "Order.orderItems.orderItemId",
      Title: "Order.orderItems.product.title",
      QuantityOrdered: "Order.orderItems.quantityOrdered",
      QuantityShipped: "Order.orderItems.fulfillment.quantityFulfilled",
      PointsGranted: "Order.orderItems.expense.pointsCost.pointsGranted",
      ItemPrice:
        "Order.orderItems.proceeds.breakdowns.subtotal (with type == ITEM)",
      ShippingPrice:
        "Order.orderItems.proceeds.breakdowns.subtotal (with type == SHIPPING)",
      ItemTax:
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == TAX && subtype == ITEM)",
      ShippingTax:
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == TAX && subtype == SHIPPING)",
      ShippingDiscount:
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == DISCOUNT && subtype == SHIPPING)",
      PromotionDiscount:
        "Order.orderItems.proceeds.breakdowns.subtotal (with type == DISCOUNT)",
      PromotionDiscountTax:
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == TAX && subtype == DISCOUNT)",
      CODFee:
        "Order.orderItems.proceeds.breakdowns.subtotal (with type == COD_FEE)",
      CODFeeDiscount:
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == DISCOUNT && subtype == COD_FEE)",
      "ItemBuyerInfo.GiftWrapPrice":
        "Order.orderItems.proceeds.breakdowns.subtotal (with type == GIFT_WRAP)",
      "ItemBuyerInfo.GiftWrapTax":
        "Order.orderItems.proceeds.breakdowns.detailedBreakdowns.value (type == TAX && subtype == GIFT_WRAP)",
      PromotionIds: "Order.orderItems.promotion.breakdowns.promotionId",
      IsGift: "Order.orderItems.fulfillment.packing.giftOption",
      ConditionNote: "Order.orderItems.product.condition",
      ScheduledDeliveryStartDate:
        "Order.orderItems.fulfillment.shipping.scheduledDeliveryWindow",
      ScheduledDeliveryEndDate:
        "Order.orderItems.fulfillment.shipping.scheduledDeliveryWindow",
      PriceDesignation: "Order.orderItems.product.price.priceDesignation",
      IossNumber:
        "Order.orderItems.fulfillment.shipping.internationalShipping.iossNumber",
      IsTransparency: "Order.orderItems.programs (check for TRANSPARENCY)",
      "ItemBuyerInfo.BuyerCustomizedInfo":
        "Order.orderItems.product.customization",
      "ItemBuyerInfo.BuyerCustomizedInfo.CustomizedURL":
        "Order.orderItems.product.customization.customizedUrl",
      "ItemBuyerInfo.GiftMessageText":
        "Order.orderItems.fulfillment.packing.giftOption.giftMessage",
      "ItemBuyerInfo.GiftWrapLevel":
        "Order.orderItems.fulfillment.packing.giftOption.giftWrapLevel",
      "BuyerRequestedCancel.IsBuyerRequestedCancel":
        "Order.orderItems.cancellation.requester (check for BUYER)",
      "BuyerRequestedCancel.BuyerCancelReason":
        "Order.orderItems.cancellation.cancelReason",
      SerialNumbers: "Order.orderItems.product.serialNumbers",
      SubstitutionPreferences:
        "Order.orderItems.fulfillment.picking.substitutionPreference",
      Measurement: "Order.orderItems.measurement",
      ShippingConstraints:
        "Order.orderItems.fulfillment.shipping.shippingConstraints",
      AmazonPrograms:
        "Order.orderItems.programs or Order.programs (check for SUBSCRIBE_AND_SAVE, FBM_SHIP_PULS)",
    },
    newFeatures: [
      "Order.programs with AMAZON_BAZAAR",
      "Order.programs with AMAZON_HAUL",
      "Order.programs with AMAZON_EASY_SHIP (non-Brazil) or DELIVERY_BY_AMAZON (Brazil only)",
      "Order.orderItems.product.price.unitPrice",
      "Order.orderItems.proceeds.proceedsTotal",
      "Order.orderItems.fulfillment.shipping.shippingConstraints.cashOnDelivery",
      "Order.packages for FBM orders (carrier, shippingService, trackingNumber, package status)",
    ],
    apiMapping: {
      getOrders: {
        v1: "search_orders (with filters)",
        status: "✅ Available",
        notes: "Use with filters like createdAfter, marketplaceIds, etc.",
      },
      getOrder: {
        v1: "get_order (with includedData parameter)",
        status: "✅ Available",
        notes:
          "Order items included by default, use includedData for additional data",
      },
      getOrderBuyerInfo: {
        v1: "get_order (with includedData=['BUYER'])",
        status: "✅ Available",
        notes: "Include BUYER in includedData parameter",
      },
      getOrderAddress: {
        v1: "get_order (with includedData=['RECIPIENT'])",
        status: "✅ Available",
        notes: "Include RECIPIENT in includedData parameter",
      },
      getOrderItems: {
        v1: "get_order (order items included by default)",
        status: "✅ Available",
        notes: "Order items are always included, no need for separate call",
      },
      getOrderItemsBuyerInfo: {
        v1: "get_order (with includedData=['BUYER'])",
        status: "✅ Available",
        notes: "Item buyer info included when BUYER is in includedData",
      },
      getOrderRegulatedInfo: {
        v1: "No V1 counterpart",
        status: "❌ Not Available",
        notes:
          "Continue using V0 API: GET /orders/v0/orders/{orderId}/regulatedInfo",
      },
      updateShipmentStatus: {
        v1: "No V1 counterpart",
        status: "❌ Not Available",
        notes:
          "Continue using V0 API: POST /orders/v0/orders/{orderId}/shipment",
      },
      updateVerificationStatus: {
        v1: "No V1 counterpart",
        status: "❌ Not Available",
        notes:
          "Continue using V0 API: PATCH /orders/v0/orders/{orderId}/verificationStatus",
      },
      confirmShipment: {
        v1: "No V1 counterpart",
        status: "❌ Not Available",
        notes:
          "Continue using V0 API: POST /orders/v0/orders/{orderId}/shipConfirmation",
      },
      cancelOrder: {
        v1: "cancel_order",
        status: "✅ Available",
        notes:
          "Available in V1 as PUT /orders/v1/orders/{orderId}/cancellation",
      },
    },
  };
}
