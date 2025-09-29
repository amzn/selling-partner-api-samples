# Data Kiosk Query Constants
QUERY_UC1 = (
    "query { analytics_economics_2024_03_15 { economics( marketplaceIds: [\"ATVPDKIKX0DER\"], "
    "startDate: \"2025-06-01\", endDate: \"2025-06-05\", "
    "aggregateBy: { date: DAY, productId: MSKU } ) "
    "{ startDate endDate msku marketplaceId sales { unitsOrdered netUnitsSold "
    "netProductSales { amount currencyCode } } netProceeds { total { amount currencyCode } } } } }"
)

QUERY_UC2 = (
    "query {analytics_salesAndTraffic_2024_04_24 "
    "{salesAndTrafficByAsin(aggregateBy:CHILD,endDate:\"2025-06-06\",startDate:\"2025-03-01\",marketplaceIds:[\"ATVPDKIKX0DER\"]) "
    "{sales {orderedProductSales {amount currencyCode} totalOrderItems unitsOrdered} "
    "traffic {pageViews buyBoxPercentage} sku childAsin}}}"
)

QUERY_UC3 = (
    "query { analytics_economics_2024_03_15 { economics( "
    "marketplaceIds: [\"ATVPDKIKX0DER\"], "
    "startDate: \"2025-06-01\", endDate: \"2025-06-05\", "
    "aggregateBy: { date: DAY, productId: MSKU } ) { "
    "msku startDate endDate sales { "
    "unitsOrdered unitsRefunded "
    "orderedProductSales { amount currencyCode } "
    "refundedProductSales { amount currencyCode } "
    "} } } }"
)

# Buy Shipping Expected Values
EXPECTED_SHIP_FROM = {
    "name": "Harsh The Sock Hero",
    "addressLine1": "Laundry Room B2",
    "addressLine2": "SoloSock HQ (Above Grandma's Garage)",
    "city": "Seattle",
    "stateOrRegion": "IM",
    "postalCode": "40404",
    "countryCode": "US",
    "companyName": "SoloSock Inc.",
    "phoneNumber": "+1-867-5309"
}

EXPECTED_SHIP_TO = {
    "name": "Chris 'Fulfillment Guru' Khoury",
    "addressLine1": "Amazon API Temple",
    "addressLine2": "Suite 404 – Socks Not Found",
    "city": "Debugville",
    "stateOrRegion": "WA",
    "postalCode": "98199",
    "countryCode": "US"
}

EXPECTED_ORDER_ID = "111-1111111-1111111"
EXPECTED_ITEM_IDENTIFIER = "111111111111111"

# Valid rate IDs for shipping
VALID_RATE_IDS = ["fast-express-003", "cheap-pigeon-002", "economy-ss-001"]
