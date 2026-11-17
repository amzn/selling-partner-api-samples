"""
Integration tests for Vendor Shipments API.

GET tests hit real endpoint, POST tests hit sandbox.

Required environment variables:
- SP_API_CLIENT_ID
- SP_API_CLIENT_SECRET
- SP_API_REFRESH_TOKEN

Optional:
- SP_API_ENDPOINT (default: https://sellingpartnerapi-na.amazon.com)
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import pytest
from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_shipments_v1.vendor_shipment_api import VendorShipmentApi

logger = logging.getLogger(__name__)

SP_API_ENDPOINT = os.environ.get("SP_API_ENDPOINT", "https://sellingpartnerapi-na.amazon.com")
SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com"

pytestmark = pytest.mark.skipif(
    not os.environ.get("SP_API_CLIENT_ID"),
    reason="SP_API_CLIENT_ID not set — skipping integration test",
)


def _build_config():
    return SPAPIConfig(
        client_id=os.environ["SP_API_CLIENT_ID"],
        client_secret=os.environ["SP_API_CLIENT_SECRET"],
        refresh_token=os.environ["SP_API_REFRESH_TOKEN"],
        region="NA",
    )


@pytest.fixture(scope="module")
def vendor_shipping_api():
    config = _build_config()
    client = SPAPIClient(config, endpoint=SP_API_ENDPOINT)
    # Disable client-side validation — the real API may return enum values
    # (e.g., "pounds") that the SDK model doesn't recognize yet.
    client.api_client.configuration.client_side_validation = False
    api = VendorShipmentApi(client.api_client)
    logger.info("INTEGRATION TEST - Vendor Shipments (Endpoint: %s)", SP_API_ENDPOINT)
    return api


@pytest.fixture(scope="module")
def vendor_shipping_api_sandbox():
    config = _build_config()
    client = SPAPIClient(config, endpoint=SANDBOX_ENDPOINT)
    api = VendorShipmentApi(client.api_client)
    logger.info("SANDBOX TEST - Vendor Shipments (Endpoint: %s)", SANDBOX_ENDPOINT)
    return api


def test_get_shipment_details(vendor_shipping_api):
    logger.info("--- Testing getShipmentDetails (last 30 days) ---")
    now = datetime.now(timezone.utc)
    # Use _preload_content=False to avoid SDK enum validation bug
    # where the API returns "pounds" but the SDK only allows ['G', 'Kg', 'Oz', 'Lb'].
    import json
    raw_response = vendor_shipping_api.get_shipment_details(
        limit=10,
        sort_order="DESC",
        created_after=now - timedelta(days=30),
        created_before=now,
        _preload_content=False,
    )
    response = json.loads(raw_response.data)
    payload = response.get("payload") or {}
    shipments = payload.get("shipments") or []
    logger.info("Found %d shipments", len(shipments))
    for shipment in shipments:
        logger.info("  Shipment: %s | Buyer Ref: %s | Status: %s",
                    shipment.get("vendorShipmentIdentifier"),
                    shipment.get("buyerReferenceNumber"),
                    shipment.get("currentShipmentStatus"))


def test_get_shipment_labels(vendor_shipping_api):
    logger.info("--- Testing getShipmentLabels (last 30 days) ---")
    now = datetime.now(timezone.utc)
    response = vendor_shipping_api.get_shipment_labels(
        limit=10,
        sort_order="DESC",
        label_created_after=now - timedelta(days=30),
        label_created_before=now,
    )
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    labels = payload.get("transport_labels") or []
    logger.info("Found %d transport labels", len(labels))


def test_submit_shipment_confirmations(vendor_shipping_api_sandbox):
    logger.info("--- Testing submitShipmentConfirmations (sandbox) ---")

    # Values below are required by SP-API static sandbox — the sandbox only returns
    # a valid response when the request matches this exact payload.
    body = {
        "shipmentConfirmations": [
            {
                "shipmentIdentifier": "TestShipmentConfirmation202",
                "shipmentConfirmationDate": datetime.now(timezone.utc).isoformat(),
                "sellingParty": {"partyId": "ABCD1"},
                "shipFromParty": {"partyId": "EFGH1"},
                "shipToParty": {"partyId": "JKL1"},
                "shipmentConfirmationType": "Original",
                "shippedItems": [
                    {
                        "itemSequenceNumber": "001",
                        "shippedQuantity": {"amount": 100, "unitOfMeasure": "Eaches"},
                    }
                ],
            }
        ]
    }
    response = vendor_shipping_api_sandbox.submit_shipment_confirmations(body=body)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    transaction_id = payload.get("transaction_id")
    if transaction_id:
        logger.info("Transaction ID: %s", transaction_id)


def test_submit_shipments(vendor_shipping_api_sandbox):
    logger.info("--- Testing submitShipments (sandbox) ---")

    # Values below are required by SP-API static sandbox — the sandbox only returns
    # a valid response when the request matches this exact payload.
    body = {
        "shipments": [
            {
                "vendorShipmentIdentifier": "00050003",
                "buyerReferenceNumber": "1234567",
                "transactionType": "New",
                "transactionDate": datetime.now(timezone.utc).isoformat(),
                "shipmentFreightTerm": "Collect",
                "sellingParty": {"partyId": "PQRSS"},
                "shipFromParty": {
                    "partyId": "999US",
                    "address": {
                        "name": "ABC electronics warehouse",
                        "addressLine1": "DEF 1st street",
                        "city": "Lisses",
                        "stateOrRegion": "abcland",
                        "postalCode": "91090",
                        "countryCode": "DE",
                    },
                },
                "shipToParty": {"partyId": "ABCDF"},
                "shipmentMeasurements": {
                    "totalCartonCount": 30,
                    "totalPalletStackable": 30,
                    "totalPalletNonStackable": 30,
                },
                "purchaseOrders": [
                    {
                        "purchaseOrderNumber": "1BBBAAAA",
                        "items": [
                            {
                                "itemSequenceNumber": "001",
                                "vendorProductIdentifier": "9782700001659",
                                "shippedQuantity": {"amount": 100, "unitOfMeasure": "Eaches"},
                            }
                        ],
                    }
                ],
            }
        ]
    }
    response = vendor_shipping_api_sandbox.submit_shipments(body=body)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    transaction_id = payload.get("transaction_id")
    if transaction_id:
        logger.info("Transaction ID: %s", transaction_id)
