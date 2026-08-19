# Vendor Retail Procurement - Python Code Recipes

Sample code demonstrating the SP-API Vendor Retail Procurement APIs (Orders, Shipments, Invoices, and Transaction Status) in Python.

## Prerequisites

- Python 3.9+
- `amzn-sp-api` SDK (`pip install amzn-sp-api`)
- `pytest` (for running tests)

## Structure

```
src/recipes/vendor_retail_procurement/
├── orders/
│   ├── get_purchase_orders_recipe.py        # List orders by date/state/changes
│   ├── get_purchase_order_recipe.py         # Get a single order by PO number
│   ├── get_purchase_orders_status_recipe.py # Check order statuses
│   └── submit_acknowledgement_recipe.py     # Accept or reject orders
├── shipments/
│   ├── get_shipment_details_recipe.py       # Query shipments by date/ID/reference
│   ├── get_shipment_labels_recipe.py        # Download shipping labels (PDF)
│   ├── submit_shipment_confirmation_recipe.py  # Confirm items have shipped
│   └── submit_shipments_recipe.py           # Create/update/cancel shipments
├── invoices/
│   └── submit_invoices_recipe.py            # Submit invoices or credit notes
└── transaction/
    └── get_transaction_recipe.py            # Poll async transaction status
```

## How Recipes Work

Each recipe extends `src.util.recipe.Recipe`, which provides pre-configured `SPAPIConfig` credentials. Recipes are designed to be read and copied — they demonstrate API usage patterns rather than production-ready code.

All recipes use Python's built-in `logging` module for structured output.

## Building and Running

```bash
cd code-recipes/python

# Install dependencies
pip install amzn-sp-api pytest

# Run a recipe directly
python -m src.recipes.vendor_retail_procurement.orders.get_purchase_orders_recipe
```

## Unit Tests (Mock Backend)

Unit tests run against a local Node.js mock backend (`localhost:3000`). The mock returns canned JSON responses from `test/responses/`. No credentials are needed.

```bash
# Start mock backend (from code-recipes/java directory)
cd ../java && ./gradlew startMockBackend

# Run all vendor retail procurement unit tests
cd ../python
pytest tests/vendor_retail_procurement/orders/ \
       tests/vendor_retail_procurement/shipments/ \
       tests/vendor_retail_procurement/invoices/ \
       tests/vendor_retail_procurement/transaction/ -v

# Stop mock backend
cd ../java && ./gradlew stopMockBackend
```

## Integration Tests (Real SP-API)

Integration tests live under `tests/vendor_retail_procurement/integration/`:

```
tests/vendor_retail_procurement/integration/
├── test_get_purchase_orders_integration.py      # GET — real endpoint
├── test_shipments_integration.py                # GET — real endpoint + POST — sandbox
├── test_submit_acknowledgement_integration.py   # POST — static sandbox
├── test_invoices_integration.py                 # POST — static sandbox
└── test_transaction_integration.py              # GET — real endpoint
```

- **GET tests** hit the real SP-API endpoint and return live data from your vendor account.
- **POST tests** hit the SP-API static sandbox (`https://sandbox.sellingpartnerapi-na.amazon.com`). The sandbox expects a fixed request payload and returns a canned response. To test POST operations against production, you must replace both the endpoint and the request values with real data.

### Environment Variables

```json
{
  "SP_API_CLIENT_ID": "amzn1.application-oa2-client.xxxxxxxxxxxxxxxx",
  "SP_API_CLIENT_SECRET": "your-client-secret",
  "SP_API_REFRESH_TOKEN": "Atzr|your-refresh-token",
  "SP_API_ENDPOINT": "https://sellingpartnerapi-na.amazon.com",
  "SP_API_PURCHASE_ORDER": "4Z32PABC",
  "SP_API_TRANSACTION_ID": "20190904190535-eef8cad8-418e-4ed3-ac72-789e2ee6214a"
}
```

| Variable | Required | Description |
|----------|----------|-------------|
| `SP_API_CLIENT_ID` | Yes | Your SP-API application client ID |
| `SP_API_CLIENT_SECRET` | Yes | Your SP-API application client secret |
| `SP_API_REFRESH_TOKEN` | Yes | Refresh token for the vendor account |
| `SP_API_ENDPOINT` | No | Override SP-API endpoint (default: NA production) |
| `SP_API_PURCHASE_ORDER` | No | Specific PO number (auto-picks from list if not set) |
| `SP_API_TRANSACTION_ID` | No | Transaction ID for status lookup tests |

Tests are gated with `pytest.mark.skipif` — they skip automatically when `SP_API_CLIENT_ID` is not set.

### Running Integration Tests

```bash
# Set credentials
export SP_API_CLIENT_ID="amzn1.application-oa2-client.xxxxxxxxxxxxxxxx"
export SP_API_CLIENT_SECRET="your-client-secret"
export SP_API_REFRESH_TOKEN="Atzr|your-refresh-token"

# Run all integration tests
pytest tests/vendor_retail_procurement/integration/ -v

# Run only GET (read-only) tests
pytest tests/vendor_retail_procurement/integration/test_get_purchase_orders_integration.py -v
pytest tests/vendor_retail_procurement/integration/test_shipments_integration.py::test_get_shipment_details -v
pytest tests/vendor_retail_procurement/integration/test_shipments_integration.py::test_get_shipment_labels -v
pytest tests/vendor_retail_procurement/integration/test_transaction_integration.py -v

# Run only POST (sandbox) tests
pytest tests/vendor_retail_procurement/integration/test_submit_acknowledgement_integration.py -v
pytest tests/vendor_retail_procurement/integration/test_shipments_integration.py::test_submit_shipment_confirmations -v
pytest tests/vendor_retail_procurement/integration/test_shipments_integration.py::test_submit_shipments -v
pytest tests/vendor_retail_procurement/integration/test_invoices_integration.py -v
```

## GET vs POST Test Endpoints

| Test Type | Endpoint | Why |
|-----------|----------|-----|
| GET (read-only) | `https://sellingpartnerapi-na.amazon.com` | Safe to run against real data |
| POST (mutating) | `https://sandbox.sellingpartnerapi-na.amazon.com` | Avoids modifying real orders |

### About Sandbox Hardcoded Values

POST integration tests contain hardcoded values like `"TestOrder202"`, `"ABCD1"`, `"028877454078"`, etc. These are **not** arbitrary — the SP-API static sandbox requires an exact request payload to return a valid response. They represent the sandbox contract, not real data.

### Using POST Tests Against Production

To run POST operations against a real endpoint, change the endpoint:

```python
# Change from sandbox:
SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com"

# To production (or use SP_API_ENDPOINT env var):
import os
ENDPOINT = os.environ.get("SP_API_ENDPOINT", "https://sellingpartnerapi-na.amazon.com")
```

Then replace the sandbox fixture values with real data from your vendor account (real PO numbers, party IDs, product identifiers, etc.).

> **Warning:** POST operations against production will modify real orders, create real shipments, or submit real invoices. Use with caution.

## API Reference

- [Vendor Orders API](https://developer-docs.amazon.com/sp-api/docs/vendor-orders-api-v1-reference)
- [Vendor Shipments API](https://developer-docs.amazon.com/sp-api/docs/vendor-shipments-api-v1-reference)
- [Vendor Invoices API](https://developer-docs.amazon.com/sp-api/docs/vendor-invoices-api-v1-reference)
- [Vendor Transaction Status API](https://developer-docs.amazon.com/sp-api/docs/vendor-transaction-status-api-v1-reference)
