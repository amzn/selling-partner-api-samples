"""
Sample Payloads for the MCF (Multichannel Fulfillment) order processing recipes.

These provide realistic sample payloads for the MCF workflows. When adapting
these for your own application, replace the placeholder values marked with
angle brackets (e.g., <recipient-name>) with real data.


"""

# -- Step 1: getFulfillmentPreview request body --------------------------------
# Use this to check shipping speeds, estimated delivery dates, and fees before committing to an order.

sample_preview_request = {
    "address": {
        "name": "<recipient-name>",
        "addressLine1": "<address-line-1>",
        "city": "<city>",
        "stateOrRegion": "<state>",              # e.g., "WA", "CA", "NY"
        "postalCode": "<postal-code>",            # e.g., "98101"
        "countryCode": "US",
    },
    "items": [
        {
            "sellerSku": "MY-SKU-001",                       # Your FBA-enrolled SKU
            "quantity": 1,
            "sellerFulfillmentOrderItemId": "item-001",      # Your unique line-item ID
        }
    ],
    # Optional fields you may add:
    # "shippingSpeedCategories": ["Standard", "Expedited", "Priority"],
    # 
    # "featureConstraints": [
    #   {
    #    "featureName": "BLOCK_AMZL",            # Features can be BLANK_BOX or BLOCK_AMZL 
    #    "featureFulfillmentPolicy": "Required"
    #   }
    #    ]

}

# -- Step 2: createFulfillmentOrder request body -------------------------------
# Use this to actually submit the MCF order for fulfillment.
sample_create_order_request = {
    "sellerFulfillmentOrderId": "MCF-TEST-ORDER-001",   # Your unique order ID (max 40 chars)
    "displayableOrderId": "TEST-DISPLAY-001",            # Shown to the customer on packing slip
    "displayableOrderDate": "2026-03-27T00:00:00Z",      # Order date shown to customer
    "displayableOrderComment": "MCF code recipe test order",  # Comment on packing slip
    "shippingSpeedCategory": "Standard",                 # Standard | Expedited | Priority
    "destinationAddress": {
        "name": "<recipient-name>",
        "addressLine1": "<address-line-1>",
        "city": "<city>",
        "stateOrRegion": "<state>",
        "postalCode": "<postal-code>",
        "countryCode": "US",
    },
    "items": [
        {
            "sellerSku": "MY-SKU-001",                       # Must match an FBA-enrolled SKU
            "sellerFulfillmentOrderItemId": "item-001",      # Your unique line-item ID
            "quantity": 1,
        }
    ],
    # Optional fields you may add:
    # "notificationEmails": ["customer@example.com"],
    # "featureConstraints": [{"featureName": "BLANK_BOX", "featureFulfillmentPolicy": "Required"}],  # Features can be BLANK_BOX or BLOCK_AMZL
    # "fulfillmentPolicy": "FillOrKill"                     # FillorKill | FillAll | FillAllAvailable
    # FillorKill - it's all-or-nothing, ideal when partial fulfillment isn't acceptable.
    # FillAll - All fulfillable items are shipped. Any unfulfillable items remain open for the seller to decide.
    # FillAllAvailable - All fulfillable items are shipped immediately. All unfulfillable items are automatically cancelled.
}

# -- Step 2 (alternate version for Hold orders): createFulfillmentOrder with Hold action ---------------
# Use this payload to create an order that is NOT shipped immediately.
# The order stays on hold until you call updateFulfillmentOrder with "fulfillmentAction"="Ship" to release it.
sample_create_order_request_on_hold = {
    "sellerFulfillmentOrderId": "MCF-TEST-ORDER-001",   # Your unique order ID (max 40 chars)
    "displayableOrderId": "TEST-DISPLAY-001",           # Shown to the customer on packing slip
    "displayableOrderDate": "2026-03-27T00:00:00Z",     # Order date shown to customer
    "displayableOrderComment": "MCF code recipe test order",   # Comment on packing slip
    "shippingSpeedCategory": "Standard",                # Standard | Expedited | Priority
    "fulfillmentAction": "Hold",                         # Hold = do not ship yet
    "destinationAddress": {
        "name": "<recipient-name>",
        "addressLine1": "<address-line-1>",
        "city": "<city>",
        "stateOrRegion": "<state>",
        "postalCode": "<postal-code>",
        "countryCode": "US",
    },
    "items": [
        {
            "sellerSku": "MY-SKU-001",                    # Must match an FBA-enrolled SKU
            "sellerFulfillmentOrderItemId": "item-001",   # Your unique line-item ID
            "quantity": 1,
        }
    ],
}
