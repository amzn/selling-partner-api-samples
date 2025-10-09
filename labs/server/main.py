"""
Amazon SP-API Mock Server
A professional mock server for testing Amazon Selling Partner API integrations.
Supports Data Kiosk, Buy Shipping, and Listings APIs.
"""

from fastapi import FastAPI, Request, HTTPException, Body, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import json
from constants import *
import logging
from pathlib import Path
from typing import Dict, Any, Optional, List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Paths
RESPONSES_DIR = Path("responses")
DATAKIOSK_DIR = RESPONSES_DIR / "datakiosk"
SHIPPING_DIR = RESPONSES_DIR / "shipping-guru"
LISTINGS_DIR = RESPONSES_DIR / "listings-wizard"

def load_json_response(*parts: str) -> Dict[Any, Any]:
    """
    Load JSON response from a path under responses/ with error handling.
    Usage: load_json_response("datakiosk", "file.json") or load_json_response("file.json")
    """
    filepath = RESPONSES_DIR.joinpath(*parts)
    try:
        with open(filepath, "r", encoding="utf-8") as file:
            return json.load(file)
    except FileNotFoundError:
        logger.error(f"Response file not found: {filepath}")
        raise HTTPException(
            status_code=500,
            detail=f"Mock response file not found: {filepath}"
        )
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in {filepath}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Invalid JSON in mock response file: {filepath}"
        )

def _check_required(dirpath: Path, files: List[str]) -> List[str]:
    missing = []
    for f in files:
        if not (dirpath / f).exists():
            missing.append(str(dirpath / f))
    return missing

def validate_responses_directory():
    """Validate that responses directory exists and contains required files."""
    if not RESPONSES_DIR.exists():
        logger.error(f"Responses directory not found: {RESPONSES_DIR}")
        raise RuntimeError(f"Responses directory not found: {RESPONSES_DIR}")

    # Expected files per subfolder
    required_datakiosk = [
        "mock_uc_1_dk_response.json",
        "mock_uc_2_dk_response.json",
        "mock_uc_3_dk_response.json",
    ]
    required_shipping = [
        "get_order_response.json",
        "get_rates_response.json",
        "purchase_shipment_response.json",
        "get_tracking_response.json",
    ]
    required_listings = [
        "low_conversion_get_listing_response.json",
        "high_refund_get_listing_response.json",
        "low_conversion_patch_listing_response.json",
        "pricing_performance_patch_listing_response.json",
        "high_refund_patch_listing_response.json",
        "pricing_performance_get_competitive_summary_response.json",
    ]

    missing_any = False

    for subdir in [DATAKIOSK_DIR, SHIPPING_DIR, LISTINGS_DIR]:
        if not subdir.exists():
            logger.warning(f"Expected subdirectory not found: {subdir}")
            missing_any = True

    missing_files = []
    missing_files += _check_required(DATAKIOSK_DIR, required_datakiosk)
    missing_files += _check_required(SHIPPING_DIR, required_shipping)
    missing_files += _check_required(LISTINGS_DIR, required_listings)

    if missing_files:
        missing_any = True
        logger.warning("Missing response files:")
        for mf in missing_files:
            logger.warning(f"  - {mf}")

    if missing_any:
        logger.warning("Some response resources are missing. Endpoints depending on them may return 500/400.")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Amazon SP-API Mock Server")
    validate_responses_directory()
    logger.info("Server initialized successfully")
    yield
    logger.info("Shutting down Amazon SP-API Mock Server")

# Initialize FastAPI app
app = FastAPI(
    title="Amazon SP-API Mock Server",
    description="Professional mock server for Amazon Selling Partner API testing",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint with server information."""
    return {
        "service": "Amazon SP-API Mock Server",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "auth": "/auth/o2/token",
            "dataKiosk": "/dataKiosk/2023-11-15/*",
            "orders": "/orders/v0/*",
            "shipping": "/shipping/v2/*",
            "listings": "/listings/2021-08-01/*",
            "pricing": "/batches/products/pricing/2022-05-01/*"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

# ==================== Authentication ====================

@app.post("/auth/o2/token")
async def mock_oauth_token(request: Request):
    """Mock OAuth2 token endpoint."""
    form = await request.form()
    logger.info("OAuth token requested")
    return {
        "access_token": "MockAccessToken",
        "token_type": "bearer",
        "expires_in": 3600,
        "refresh_token": form.get("refresh_token", "mock_refresh_token")
    }

# ==================== Data Kiosk API ====================

@app.post("/dataKiosk/2023-11-15/queries")
def create_query(body: dict = Body(...)):
    """Create a Data Kiosk query."""
    query = body.get("query")
    logger.info(f"Creating query: {query[:50]}...")

    query_map = {
        QUERY_UC1: {"queryId": "1000001"},
        QUERY_UC2: {"queryId": "1000002"},
        QUERY_UC3: {"queryId": "1000003"}
    }

    if query in query_map:
        return JSONResponse(content=query_map[query])

    raise HTTPException(
        status_code=400,
        detail=f"🎯 Submitted query is not valid. Try again!"
    )

@app.get("/dataKiosk/2023-11-15/queries/{queryId}")
def get_query(queryId: str):
    """Get query status by ID."""
    logger.info(f"Fetching query status: {queryId}")

    query_responses = {
        "1000001": {
            "queryId": "1000001",
            "query": QUERY_UC1,
            "createdTime": "2025-07-17T11:25:13.645Z",
            "processingStatus": "DONE",
            "processingStartTime": "2025-07-17T11:25:13.645Z",
            "processingEndTime": "2025-07-17T11:25:13.645Z",
            "dataDocumentId": "usecase_1_document_id.amzn.100001",
        },
        "1000002": {
            "queryId": "1000002",
            "query": QUERY_UC2,
            "createdTime": "2025-07-17T11:25:13.645Z",
            "processingStatus": "DONE",
            "processingStartTime": "2025-07-17T11:25:13.645Z",
            "processingEndTime": "2025-07-17T11:25:13.645Z",
            "dataDocumentId": "usecase_2_document_id.amzn.100002",
        },
        "1000003": {
            "queryId": "1000003",
            "query": QUERY_UC3,
            "createdTime": "2025-07-17T11:25:13.645Z",
            "processingStatus": "DONE",
            "processingStartTime": "2025-07-17T11:25:13.645Z",
            "processingEndTime": "2025-07-17T11:25:13.645Z",
            "dataDocumentId": "usecase_3_document_id.amzn.100003",
        }
    }

    if queryId in query_responses:
        return JSONResponse(content=query_responses[queryId])

    raise HTTPException(
        status_code=400,
        detail=f"🎯 Query ID '{queryId}' is not valid. Try again!"
    )

@app.get("/dataKiosk/2023-11-15/queries")
def get_queries():
    """Get all queries."""
    logger.info("Fetching all queries")
    return JSONResponse(content={
        "queries": [
            {
                "queryId": "1000001",
                "query": QUERY_UC1,
                "createdTime": "2025-07-17T11:25:13.645Z",
                "processingStatus": "DONE",
                "processingStartTime": "2025-07-17T11:25:13.645Z",
                "processingEndTime": "2025-07-17T11:25:13.645Z",
                "dataDocumentId": "usecase_1_document_id.amzn.100001",
            },
            {
                "queryId": "1000002",
                "query": QUERY_UC2,
                "createdTime": "2025-07-17T11:25:13.645Z",
                "processingStatus": "DONE",
                "processingStartTime": "2025-07-17T11:25:13.645Z",
                "processingEndTime": "2025-07-17T11:25:13.645Z",
                "dataDocumentId": "usecase_2_document_id.amzn.100002",
            },
            {
                "queryId": "1000003",
                "query": QUERY_UC3,
                "createdTime": "2025-07-17T11:25:13.645Z",
                "processingStatus": "DONE",
                "processingStartTime": "2025-07-17T11:25:13.645Z",
                "processingEndTime": "2025-07-17T11:25:13.645Z",
                "dataDocumentId": "usecase_3_document_id.amzn.100003",
            }
        ]
    })

@app.get("/dataKiosk/2023-11-15/documents/{documentId}")
def get_document(documentId: str):
    """Get document data by ID."""
    logger.info(f"Fetching document: {documentId}")

    document_map = {
        "usecase_1_document_id.amzn.100001": "mock_uc_1_dk_response.json",
        "usecase_2_document_id.amzn.100002": "mock_uc_2_dk_response.json",
        "usecase_3_document_id.amzn.100003": "mock_uc_3_dk_response.json"
    }

    if documentId in document_map:
        data = load_json_response("datakiosk", document_map[documentId])
        return JSONResponse(content=data)

    raise HTTPException(
        status_code=400,
        detail=f"💽 Document ID '{documentId}' is not valid. Try again!"
    )

# ==================== Orders API ====================

@app.get("/orders/v0/orders/{orderId}")
def get_order(orderId: str):
    """Get order details by ID."""
    logger.info(f"Fetching order: {orderId}")

    if orderId != EXPECTED_ORDER_ID:
        raise HTTPException(
            status_code=400,
            detail=f"💽 Invalid Order ID: '{orderId}'. Expected '{EXPECTED_ORDER_ID}'"
        )

    data = load_json_response("shipping-guru", "get_order_response.json")
    return JSONResponse(content=data)

# ==================== Shipping API ====================

def validate_address_field(section: str, field: str, expected: str, actual: str) -> Optional[str]:
    """Validate address field and return error message if invalid."""
    if actual != expected:
        return f"The field '{field}' in the '{section}' address should be '{expected}', but got '{actual}'."
    return None

@app.post("/shipping/v2/shipments/rates")
def get_shipping_rates(body: dict = Body(...)):
    """Get shipping rates."""
    logger.info("Getting shipping rates")

    ship_from = body.get("shipFrom", {})
    ship_to = body.get("shipTo", {})
    amazon_order_id = body.get("channelDetails", {}).get("amazonOrderDetails", {}).get("orderId")

    packages = body.get("packages", [])
    item_identifier = None
    if packages and packages[0].get("items"):
        item_identifier = packages[0]["items"][0].get("itemIdentifier")

    errors = []

    # Validate ship from address
    for key, expected_value in EXPECTED_SHIP_FROM.items():
        error = validate_address_field("ship from", key, expected_value, ship_from.get(key))
        if error:
            errors.append(error)

    # Validate ship to address
    for key, expected_value in EXPECTED_SHIP_TO.items():
        error = validate_address_field("ship to", key, expected_value, ship_to.get(key))
        if error:
            errors.append(error)

    # Validate order ID
    if amazon_order_id != EXPECTED_ORDER_ID:
        errors.append(f"The Amazon Order ID should be '{EXPECTED_ORDER_ID}', but got '{amazon_order_id}'.")

    # Validate item identifier
    if item_identifier != EXPECTED_ITEM_IDENTIFIER:
        errors.append(f"The order item identifier should be '{EXPECTED_ITEM_IDENTIFIER}', but got '{item_identifier}'.")

    if errors:
        raise HTTPException(
            status_code=400,
            detail={"🚫 Validation Errors": errors}
        )

    data = load_json_response("shipping-guru", "get_rates_response.json")
    return JSONResponse(content=data)

@app.post("/shipping/v2/shipments")
async def purchase_shipment(body: dict = Body(...)):
    """Purchase shipment."""
    logger.info("Purchasing shipment")

    rate_id = body.get("rateId")
    doc_format = body.get("requestedDocumentSpecification", {}).get("format")

    if rate_id not in VALID_RATE_IDS:
        raise HTTPException(
            status_code=400,
            detail=f"🚫 Rate ID '{rate_id}' is not valid. Try a valid rateId!"
        )

    if rate_id == "economy-ss-001":
        raise HTTPException(
            status_code=400,
            detail="🛵 You picked the 'Economy Snail Service' 🐌 — delivery ETA: August 19. Try again!"
        )

    if rate_id == "cheap-pigeon-002":
        raise HTTPException(
            status_code=400,
            detail="🐦 Your package is hitching a ride with a semi-trained pigeon. Expected delivery: July 30. Try again!"
        )

    if doc_format != "PNG":
        raise HTTPException(
            status_code=400,
            detail=f"🎯 Great rateId ('{rate_id}'), but we only support PNG format. Not '{doc_format}'. Try again!"
        )

    data = load_json_response("shipping-guru", "purchase_shipment_response.json")
    return JSONResponse(content=data)

@app.put("/shipping/v2/shipments/{shipmentId}/cancel")
async def cancel_shipment(shipmentId: str):
    """Cancel shipment."""
    logger.info(f"Cancelling shipment: {shipmentId}")

    if shipmentId != "amzn1.sid.SHIPSOCK_ECO":
        raise HTTPException(
            status_code=400,
            detail=f"🚫 Invalid shipment ID: '{shipmentId}'. Try again!"
        )

    return {"message": f"Shipment '{shipmentId}' has been cancelled successfully!"}

@app.get("/shipping/v2/tracking")
async def get_tracking(trackingId: str = Query(...), carrierId: str = Query(...)):
    """Get tracking information."""
    logger.info(f"Getting tracking: {trackingId} / {carrierId}")

    if trackingId != "123456789123456789":
        raise HTTPException(
            status_code=400,
            detail=f"🚫 Invalid tracking ID: '{trackingId}'. Try again!"
        )

    if carrierId != "GROUNDLING_GO":
        raise HTTPException(
            status_code=400,
            detail=f"🚫 Invalid carrier ID: '{carrierId}'. Try again!"
        )

    data = load_json_response("shipping-guru", "get_tracking_response.json")
    return JSONResponse(content=data)

# ==================== Listings API ====================

@app.get("/listings/2021-08-01/items/{sellerId}/{sku}")
def get_listing(sellerId: str, sku: str):
    """Get listing item."""
    logger.info(f"Getting listing: {sku}")

    listing_map = {
        "BICYCLE-GRAY-M": "high_refund_get_listing_response.json",
        "MOTOR-GEAR-US": "low_conversion_get_listing_response.json"
    }

    if sku in listing_map:
        data = load_json_response("listings-wizard", listing_map[sku])
        return JSONResponse(content=data)

    raise HTTPException(
        status_code=400,
        detail=f"SKU '{sku}' is not valid. Try again!"
    )

@app.patch("/listings/2021-08-01/items/{sellerId}/{sku}")
def patch_listing(sellerId: str, sku: str, body: dict = Body(...)):
    """Update listing item."""
    logger.info(f"Patching listing: {sku}")

    if sku not in ["BICYCLE-GRAY-M", "MOTOR-GEAR-US", "VOLLEYBALL"]:
        raise HTTPException(
            status_code=400,
            detail=f"SKU '{sku}' is not valid. Try again!"
        )

    try:
        patches = body.get("patches", [])
        if not patches:
            raise ValueError("No patches provided")

        if sku == "MOTOR-GEAR-US":
            path = patches[0].get("path")
            product_type = body.get("productType")

            if product_type != "POWERSPORTS_PROTECTIVE_GEAR":
                raise HTTPException(
                    status_code=400,
                    detail="Product type is not valid. Try again!"
                )

            if path != "/attributes/department":
                raise HTTPException(
                    status_code=400,
                    detail="Path is not valid. Try again!"
                )

            response_file = "low_conversion_patch_listing_response.json"

        elif sku == "BICYCLE-GRAY-M":
            quantity = patches[0].get("value", [{}])[0].get("quantity")
            op = patches[0].get("op")

            if quantity != 4:
                raise HTTPException(
                    status_code=400,
                    detail="Quantity is not valid. Try again!"
                )

            if op != "merge":
                raise HTTPException(
                    status_code=400,
                    detail="Operation is not valid. Try again!"
                )

            response_file = "high_refund_patch_listing_response.json"

        elif sku == "VOLLEYBALL":
            our_price = patches[0].get("value", [{}])[0].get("our_price", [{}])[0].get("schedule", [{}])[0].get(
                "value_with_tax")

            if our_price is None or our_price > 199.49:
                raise HTTPException(
                    status_code=400,
                    detail="Price is not valid. Try again!"
                )

            response_file = "pricing_performance_patch_listing_response.json"

        data = load_json_response("listings-wizard", response_file)
        return JSONResponse(content=data)

    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Invalid request body: {e}")
        raise HTTPException(
            status_code=400,
            detail="Request body is not valid. Try again!"
        )

# ==================== Pricing API ====================

@app.post("/batches/products/pricing/2022-05-01/items/competitiveSummary")
def get_competitive_summary(body: dict = Body(...)):
    """Get competitive pricing summary."""
    logger.info("Getting competitive summary")

    try:
        requests = body.get("requests", [])
        if not requests:
            raise ValueError("No requests provided")

        asin = requests[0].get("asin")

        if asin != "B0CLZHRQK8":
            raise HTTPException(
                status_code=400,
                detail=f"ASIN '{asin}' is not valid. Try again!"
            )

        data = load_json_response("listings-wizard", "pricing_performance_get_competitive_summary_response.json")
        return JSONResponse(content=data)

    except (KeyError, IndexError, TypeError) as e:
        logger.error(f"Invalid request body: {e}")
        raise HTTPException(
            status_code=400,
            detail="Request body is not valid. Try again!"
        )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
