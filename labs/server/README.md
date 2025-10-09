# SP-API Mock Server

A deployable mock server for testing Amazon Selling Partner API integrations locally.

## ⚠️Scope & Extensibility

- This mock server is designed to test the workshops and tutorials in this repository. 
- It does not implement every SP-API mock response. 
- New use cases and workshops will be added over time; for now, only the available workshops/tutorials are supported. 
- You’re encouraged to edit/extend the server (endpoints, responses, validation logic) to match your needs.

## Quick Start

### Prerequisites

- Python 3.8 or higher
- Git
- pip (Python package manager)

### One-Command Setup (Recommended)

The fastest way to get started is using our automated setup scripts:

**macOS/Linux:**
```bash
cd sellig-partner-api-samples/labs/server
sh setup.sh
```

Or download and run:
```bash
curl -O https://raw.githubusercontent.com/amzn/sp-api-sample-solutions/main/labs/server/setup.sh
chmod +x setup.sh
./setup.sh
```

**Windows:**
```cmd
setup.bat
```

The script will automatically:
- Set up a virtual environment
- Install all dependencies
- Start the server at `http://localhost:8000`

### Manual Installation

If you prefer to set up manually:

1. **Clone the repository**
```bash
git clone https://github.com/amzn/sp-api-sample-solutions.git
cd sp-api-sample-solutions/labs/server
```

2. **Create a virtual environment**
```bash
# On macOS/Linux
python3 -m venv venv
source venv/bin/activate

# On Windows
python -m venv venv
venv\Scripts\activate
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Verify responses directory**
Ensure the `responses/` directory exists with all required JSON files:
```
responses/
├── mock_uc_1_dk_response.json
├── mock_uc_2_dk_response.json
├── mock_uc_3_dk_response.json
├── get_order_response.json
├── get_rates_response.json
├── purchase_shipment_response.json
├── get_tracking_response.json
├── get_listing1_response.json
├── get_listing3_response.json
├── patch_listing1_response.json
├── patch_listing2_response.json
├── patch_listing3_response.json
└── mock_getCompetitiveSummary_response.json
```

### Running the Server

**Start the server:**
```bash
python main.py
```

Or using uvicorn directly:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Server will be available at:**
- Local: `http://localhost:8000`
- Network: `http://0.0.0.0:8000`

## Usage

### Testing the Server

1. **Check server status:**
```bash
curl http://localhost:8000/
```

2. **Health check:**
```bash
curl http://localhost:8000/health
```

### Mock Endpoints by Workshop/Tutorial:

| Workshop / Tutorial       | API           | Method | Path                                                       | Description                  |
|----------------------------|---------------|--------|-------------------------------------------------------------|------------------------------|
| **Listings-Wizard (workshop)** | Listings API   | GET    | `/listings/2021-08-01/items/{sellerId}/{sku}`              | Get listing                  |
|                            | Listings API   | PATCH  | `/listings/2021-08-01/items/{sellerId}/{sku}`              | Update listing               |
|                            | Pricing API    | POST   | `/batches/products/pricing/2022-05-01/items/competitiveSummary` | Get competitive summary      |
| **DataKiosk (tutorial)**   | Data Kiosk API | POST   | `/dataKiosk/2023-11-15/queries`                            | Create query                 |
|                            | Data Kiosk API | GET    | `/dataKiosk/2023-11-15/queries`                            | List all queries             |
|                            | Data Kiosk API | GET    | `/dataKiosk/2023-11-15/queries/{queryId}`                  | Get query status             |
|                            | Data Kiosk API | GET    | `/dataKiosk/2023-11-15/documents/{documentId}`             | Get document data            |
| **Shipping-Guru (workshop)** | Orders API     | GET    | `/orders/v0/orders/{orderId}`                              | Get order details            |
|                            | Shipping API   | POST   | `/shipping/v2/shipments/rates`                             | Get shipping rates           |
|                            | Shipping API   | POST   | `/shipping/v2/shipments`                                   | Purchase shipment            |
|                            | Shipping API   | PUT    | `/shipping/v2/shipments/{shipmentId}/cancel`               | Cancel shipment              |
|                            | Shipping API   | GET    | `/shipping/v2/tracking`                                    | Get tracking information     |

### Common to **All** Workshops & Tutorials

| API             | Method | Path              | Description                 |
|-----------------|--------|-------------------|-----------------------------|
| Authentication  | POST   | `/auth/o2/token`  | Mock OAuth2 token generation |


## Configuration

### Environment Variables

You can customize the server behavior using environment variables:

```bash
# Server configuration
export HOST=0.0.0.0
export PORT=8000

# Logging level
export LOG_LEVEL=INFO  # DEBUG, INFO, WARNING, ERROR
```

### Custom Port

To run on a different port:
```bash
uvicorn main:app --port 3000
```

## Development

### Running with Auto-Reload

For development, use the `--reload` flag:
```bash
uvicorn main:app --reload
```

This automatically restarts the server when code changes are detected.

### Running Tests

```bash
# Install testing dependencies
pip install pytest httpx

# Run tests
pytest tests/
```

## Troubleshooting

### Port Already in Use

If port 8000 is busy:
```bash
# Find process using the port (macOS/Linux)
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port
uvicorn main:app --port 8001
```

### Missing Response Files

If you get errors about missing response files:
1. Check that the `responses/` directory exists
2. Verify all JSON files are present
3. Ensure JSON files are valid (use `python -m json.tool <file.json>`)

### Import Errors

If you get import errors:
```bash
# Reinstall dependencies
pip install --upgrade -r requirements.txt
```