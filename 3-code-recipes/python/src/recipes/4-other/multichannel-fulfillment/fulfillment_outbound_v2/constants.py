"""
Sample payloads for the MCF (Multichannel Fulfillment) Fulfillment Outbound (v2026-07-04) order-processing recipes.

These are realistic, US-focused sample payloads for the outbound API workflows. When adapting them for your own application, replace the placeholder values marked
with angle brackets (e.g., <recipient-name>) with real data.

What changed from legacy version (v2020-07-01) to the new version (2026-07-04):
  * ``sellerFulfillmentOrderId``           -> ``orderId``
  * ``destinationAddress``                 -> ``destination.deliveryAddress``
  * ``marketplaceId``                      -> ``origin.countryCode``
  * ``items``                              -> ``lineItems``
  * item ``sellerSKU``                     -> ``product.productIdentifier.amazonSku``
  * item ``sellerFulfillmentOrderItemId``  -> ``lineItemId``
  * item ``quantity: 2``                   -> ``amount: {unit: "EACHES", value: "2.0"}``
  * ``shippingSpeedCategory: "Standard"``  -> ``fulfillmentConfiguration.serviceLevel.serviceTiers: ["STANDARD"]``
  * ``fulfillmentAction: "Ship"/"Hold"``   -> ``fulfillmentConfiguration.action: "SHIP"/"HOLD"``
  * ``fulfillmentPolicy: "FillAllAvailable"`` -> ``fulfillmentConfiguration.policy: "FILL_ALL_AVAILABLE"``
  * ``featureConstraints: [CHANNEL.X]``    -> top-level ``channel`` field (e.g., "TIKTOK","WALMART","TEMU")
  * ``featureConstraints: [BLANK_BOX]``    -> ``fulfillmentConfiguration.services.packaging``

NOTE: These samples cater the US marketplace. Service tiers are limited to ``STANDARD`` and ``EXPEDITED`` (``PRIORITY`` is CA/IN/MX only and
``SCHEDULED`` is JP only). Payment-on-delivery is India-only and is intentionally omitted in these samples.
"""

# =============================================================================
# Sample payloads for RECIPE 1 — Product Page & Checkout Previews
# =============================================================================

# -- getOffers request body ----------------------------------------------------
# Lightweight, item-level "delivery promise" for the product/cart page. Works with a variable-precision address (postal code + country is enough) or an IP
# address. Returns per-item delivery date ranges with an expiry — no fees.
sample_offers_request = {
    "fulfillmentConfiguration": {
        "serviceLevel": {
            # US service tiers: STANDARD, EXPEDITED
            "serviceTiers": ["STANDARD"],
        }
    },
    "origin": {
        "countryCode": "US",
    },
    "destination": {
        # VariablePrecisionAddress: postalCode + countryCode is sufficient.
        # Alternatively, provide only "ipAddress" to geolocate the shopper: "ipAddress": "192.168.0.1"
        "deliveryAddress": {
            "postalCode": "<postal-code>",   # e.g., "98101"
            "countryCode": "US",
        }
    },
    # Multiple SKUs supported in a single call (one offerResult per item).
    "items": [
        {"productIdentifier": {"amazonSku": "MY-SKU-001"}},
        {"productIdentifier": {"amazonSku": "MY-SKU-002"}},
    ],
}

# -- getOrderPreview request body ----------------------------------------------
# Detailed, order-level preview for the checkout-review step. Requires a full delivery address. Returns planned shipments (how the order splits), estimated
# shipping weight, delivery/ship intervals, and estimated fees.
sample_preview_request = {
    "fulfillmentConfiguration": {
        "serviceLevel": {
            "serviceTiers": ["STANDARD", "EXPEDITED"],
        },
        "services": {
            "packaging": {
                # Packaging option replaces the v1 BLANK_BOX feature constraint.
                "packagingOption": "UNBRANDED",
            }
        },
    },
    "origin": {
        "countryCode": "US",
    },
    "destination": {
        "deliveryAddress": {
            "name": "<recipient-name>",
            "addressLine1": "<address-line-1>",
            "city": "<city>",
            "stateOrRegion": "<state>",       # e.g., "WA"
            "postalCode": "<postal-code>",    # e.g., "98101"
            "countryCode": "US",
        }
    },
    # Set true to omit fee estimates (faster). Default false = include fees.
    "excludeEstimatedFees": False,
    "lineItems": [
        {
            "product": {
                "productIdentifier": {"amazonSku": "MY-SKU-001"},
                # Optional declared value per unit (customs/insurance).
                "perUnitDeclaredValue": {"currencyCode": "USD", "amount": "10.00"},
            },
            "amount": {"unit": "EACHES", "value": "1"},
        }
    ],
}


# =============================================================================
# Shared order identifiers (used by recipes 2, 3, 4)
# =============================================================================
sample_order_id = "MCF-V2-TEST-ORDER-001"   # Your unique order ID


# =============================================================================
# Sample payload for RECIPE 2 — Create & Track Order and RECIPE 3 — Create & Cancel Order
# =============================================================================
sample_create_order_request = {
    "orderId": sample_order_id,
    # Optional multi-channel routing. Omit for a direct website order.
    # "channel": "TIKTOK",
    "fulfillmentConfiguration": {
        "serviceLevel": {"serviceTiers": ["STANDARD"]},
        "action": "SHIP",                     # SHIP = fulfill now (vs HOLD)
        "policy": "FILL_ALL_AVAILABLE",       # FILL_OR_KILL | FILL_ALL | FILL_ALL_AVAILABLE
# FillorKill - it's all-or-nothing, ideal when partial fulfillment isn't acceptable.
# FillAll - All fulfillable items are shipped. Any unfulfillable items remain open for the seller to decide.
# FillAllAvailable - All fulfillable items are shipped immediately. All unfulfillable items are automatically cancelled.
        "services": {
            "packaging": {"packagingOption": "UNBRANDED"},
            # Optional: request Amazon to block AMZL (Amazon Logistics) as the delivery carrier for this order.
            "additional": {"blockAMZL": "REQUIRED"},
        },
    },
    "origin": {"countryCode": "US"},
    "destination": {
        "deliveryAddress": {
            "name": "<recipient-name>",
            "addressLine1": "<address-line-1>",
            "city": "<city>",
            "stateOrRegion": "<state>",
            "postalCode": "<postal-code>",
            "countryCode": "US",
            "email": "<shopper-email>",       # optional; used for notifications
        },
        # Optional drop-off support (new in v2):
        # "deliveryNotes": "Leave at front desk",
    },
    "lineItems": [
        {
            "lineItemId": "item-001",
            "product": {"productIdentifier": {"amazonSku": "MY-SKU-001"}},
            "amount": {"unit": "EACHES", "value": "1"},
        }
    ],
}


# =============================================================================
# Sample payload for RECIPE 4 — Create On-Hold Order, then Request Shipment
# =============================================================================

# Step A: create the order with action = HOLD (not shipped yet).
sample_create_order_on_hold_request = {
    "orderId": sample_order_id,
    "fulfillmentConfiguration": {
        "serviceLevel": {"serviceTiers": ["STANDARD"]},
        "action": "HOLD",                     # HOLD = do not ship until released
        "policy": "FILL_ALL_AVAILABLE",
        "services": {
            "packaging": {"packagingOption": "UNBRANDED"},
        },
    },
    "origin": {"countryCode": "US"},
    "destination": {
        "deliveryAddress": {
            "name": "<recipient-name>",
            "addressLine1": "<address-line-1>",
            "city": "<city>",
            "stateOrRegion": "<state>",
            "postalCode": "<postal-code>",
            "countryCode": "US",
        }
    },
    "lineItems": [
        {
            "lineItemId": "item-001",
            "product": {"productIdentifier": {"amazonSku": "MY-SKU-001"}},
            "amount": {"unit": "EACHES", "value": "1"},
        }
    ],
}

# Step B: release the held order for shipment.
sample_update_order_ship_request = {
    "fulfillmentConfiguration": {
        "action": "SHIP",
    }
}


# =============================================================================
# listOrders query parameters (used by Recipe 2)
# =============================================================================
# updatedAfter : ISO 8601 timestamp; returns orders updated after this time.
# shipments    : "INCLUDE" (default) or "EXCLUDE" shipment data in the response.
# pageToken    : pagination token from a prior response's pagination.nextToken.
sample_list_orders_updated_after = "2026-01-01T00:00:00Z"
