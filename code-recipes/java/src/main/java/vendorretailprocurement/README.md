# Vendor Retail Procurement - Code Recipes

Sample code demonstrating the SP-API Vendor Retail Procurement APIs (Orders, Shipments, Invoices, and Transaction Status).

## Structure

```
vendorretailprocurement/
├── orders/
│   ├── GetPurchaseOrdersRecipe.java        # List orders by date/state/changes
│   ├── GetPurchaseOrderRecipe.java         # Get a single order by PO number
│   ├── GetPurchaseOrdersStatusRecipe.java  # Check order statuses
│   ├── SubmitAcknowledgementRecipe.java    # Accept or reject orders
│   └── OrderAcknowledgementWorkflowRecipe.java  # End-to-end: find → get → ack → verify
├── shipments/
│   ├── GetShipmentDetailsRecipe.java       # Query shipments by date/ID/reference
│   ├── GetShipmentLabelsRecipe.java        # Download shipping labels (PDF)
│   ├── SubmitShipmentConfirmationRecipe.java  # Confirm items have shipped
│   └── SubmitShipmentsRecipe.java          # Create/update/cancel shipments
├── invoices/
│   └── SubmitInvoicesRecipe.java           # Submit invoices or credit notes
└── transaction/
    └── GetTransactionRecipe.java           # Poll async transaction status
```

## Prerequisites

- Java 11+
- Gradle (wrapper included — no install needed)

## Building

All commands run from the `code-recipes/java/` directory:

```bash
cd code-recipes/java

# Compile only (skip tests)
./gradlew build -x test

# Compile and run all unit tests
./gradlew build

# Clean and rebuild
./gradlew clean build -x test
```

## How Recipes Work

Each recipe extends `util.Recipe`, which provides pre-configured `LWAAuthorizationCredentials`. Recipes are designed to be read and copied — they demonstrate API usage patterns rather than production-ready code.

### Unit Tests (Mock Backend)

Unit tests extend `util.RecipeTest` and run against a local Node.js mock backend (`localhost:3000`). The mock returns canned JSON responses from `test/responses/`. No credentials are needed.

```bash
./gradlew test
```

### Integration Tests (Real SP-API)

Integration tests live alongside the unit tests under `src/test/java/vendorretailprocurement/`:

```
src/test/java/vendorretailprocurement/
├── orders/
│   ├── GetPurchaseOrderIntegrationTest.java         # GET — real endpoint
│   ├── GetPurchaseOrdersStatusIntegrationTest.java  # GET — real endpoint
│   └── SubmitAcknowledgementIntegrationTest.java    # POST — static sandbox
├── shipments/
│   ├── GetShipmentDetailsIntegrationTest.java       # GET — real endpoint
│   ├── GetShipmentLabelsIntegrationTest.java        # GET — real endpoint
│   ├── SubmitShipmentConfirmationIntegrationTest.java  # POST — static sandbox
│   └── SubmitShipmentsIntegrationTest.java          # POST — static sandbox
├── invoices/
│   └── SubmitInvoicesIntegrationTest.java           # POST — static sandbox
└── transaction/
    └── GetTransactionIntegrationTest.java           # GET — real endpoint
```

- **GET tests** hit the real SP-API endpoint and return live data from your vendor account.
- **POST tests** hit the SP-API static sandbox (`https://sandbox.sellingpartnerapi-na.amazon.com`). The sandbox expects a fixed request payload and returns a canned response. To test POST operations against production, you must replace both the endpoint and the request values with real data (see below).

Integration tests require SP-API credentials as environment variables. Tests are gated with `@EnabledIfEnvironmentVariable` — they skip automatically when credentials are not set.

#### Environment Variables

Create a `.env.example` or export these in your shell:

```json
{
  "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxx",
  "SP_API_CLIENT_SECRET": "your-client-secret",
  "SP_API_REFRESH_TOKEN": "Atzr|your-refresh-token",
  "SP_API_ENDPOINT": "https://sellingpartnerapi-na.amazon.com",
  "SP_API_PURCHASE_ORDER": "4Z32PABC",
  "SP_API_TRANSACTION_ID": "20190904190535-eef8cad8-418e-4ed3-ac72-789e2ee6214a",
  "SP_API_VENDOR_CODE": "MYVENDOR"
}
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SP_API_CLIENT_ID` | Yes | Your SP-API application client ID |
| `SP_API_CLIENT_SECRET` | Yes | Your SP-API application client secret |
| `SP_API_REFRESH_TOKEN` | Yes | Refresh token for the vendor account |
| `SP_API_ENDPOINT` | No | Override SP-API endpoint (default: NA production) |
| `SP_API_PURCHASE_ORDER` | No | Specific PO number for single-order tests |
| `SP_API_TRANSACTION_ID` | No | Transaction ID for status lookup tests |
| `SP_API_VENDOR_CODE` | No | Vendor code filter for order queries |

#### Running the Tests

```bash
# Set credentials
export SP_API_CLIENT_ID="amzn1.application-oa2-client.xxxxxxxxxxxxxxxx"
export SP_API_CLIENT_SECRET="your-client-secret"
export SP_API_REFRESH_TOKEN="Atzr|your-refresh-token"

# Run all unit tests (mock backend, no credentials needed)
./gradlew test

# Run all vendor retail procurement integration tests
./gradlew test --tests "vendorretailprocurement.*IntegrationTest"

# Run only GET (read-only) integration tests
./gradlew test --tests "vendorretailprocurement.orders.GetPurchaseOrderIntegrationTest"
./gradlew test --tests "vendorretailprocurement.orders.GetPurchaseOrdersStatusIntegrationTest"
./gradlew test --tests "vendorretailprocurement.shipments.GetShipmentDetailsIntegrationTest"
./gradlew test --tests "vendorretailprocurement.shipments.GetShipmentLabelsIntegrationTest"
./gradlew test --tests "vendorretailprocurement.transaction.GetTransactionIntegrationTest"

# Run only POST (sandbox) integration tests
./gradlew test --tests "vendorretailprocurement.orders.SubmitAcknowledgementIntegrationTest"
./gradlew test --tests "vendorretailprocurement.shipments.SubmitShipmentConfirmationIntegrationTest"
./gradlew test --tests "vendorretailprocurement.shipments.SubmitShipmentsIntegrationTest"
./gradlew test --tests "vendorretailprocurement.invoices.SubmitInvoicesIntegrationTest"
```

## GET vs POST Test Endpoints

| Test Type | Endpoint | Why |
|-----------|----------|-----|
| GET (read-only) | `https://sellingpartnerapi-na.amazon.com` | Safe to run against real data |
| POST (mutating) | `https://sandbox.sellingpartnerapi-na.amazon.com` | Avoids modifying real orders |

### About Sandbox Hardcoded Values

POST integration tests contain hardcoded values like `"TestOrder202"`, `"ABCD1"`, `"028877454078"`, etc. These are **not** arbitrary — the SP-API static sandbox requires an exact request payload to return a valid response. They represent the sandbox contract, not real data.

### Using POST Tests Against Production

To run POST operations against a real endpoint (e.g., for live testing with a vendor account), replace the endpoint and request values:

```java
// Change from sandbox:
private static final String SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com";

// To production (or use SP_API_ENDPOINT env var):
private static final String ENDPOINT = System.getenv("SP_API_ENDPOINT") != null
        ? System.getenv("SP_API_ENDPOINT")
        : "https://sellingpartnerapi-na.amazon.com";
```

Then replace the sandbox fixture values with real data from your vendor account (real PO numbers, party IDs, product identifiers, etc.).

> **Warning:** POST operations against production will modify real orders, create real shipments, or submit real invoices. Use with caution.

## API Reference

- [Vendor Orders API](https://developer-docs.amazon.com/sp-api/docs/vendor-orders-api-v1-reference)
- [Vendor Shipments API](https://developer-docs.amazon.com/sp-api/docs/vendor-shipments-api-v1-reference)
- [Vendor Invoices API](https://developer-docs.amazon.com/sp-api/docs/vendor-invoices-api-v1-reference)
- [Vendor Transaction Status API](https://developer-docs.amazon.com/sp-api/docs/vendor-transaction-status-api-v1-reference)
