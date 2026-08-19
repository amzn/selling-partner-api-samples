"""
Integration test for submitAcknowledgement — uses SANDBOX endpoint.

Required environment variables:
- SP_API_CLIENT_ID
- SP_API_CLIENT_SECRET
- SP_API_REFRESH_TOKEN
"""

import logging
import os
from datetime import datetime, timezone

import pytest
from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

logger = logging.getLogger(__name__)

SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com"

pytestmark = pytest.mark.skipif(
    not os.environ.get("SP_API_CLIENT_ID"),
    reason="SP_API_CLIENT_ID not set — skipping integration test",
)


@pytest.fixture(scope="module")
def vendor_orders_api():
    config = SPAPIConfig(
        client_id=os.environ["SP_API_CLIENT_ID"],
        client_secret=os.environ["SP_API_CLIENT_SECRET"],
        refresh_token=os.environ["SP_API_REFRESH_TOKEN"],
        region="NA",
    )
    client = SPAPIClient(config, endpoint=SANDBOX_ENDPOINT)
    api = VendorOrdersApi(client.api_client)
    logger.info("===========================================")
    logger.info("SANDBOX TEST - submitAcknowledgement")
    logger.info("Endpoint: %s", SANDBOX_ENDPOINT)
    logger.info("===========================================")
    return api


def test_submit_acknowledgement(vendor_orders_api):
    logger.info("--- Testing submitAcknowledgement (sandbox) ---")

    # Values below are required by SP-API static sandbox — the sandbox only returns
    # a valid response when the request matches this exact payload.
    body = {
        "acknowledgements": [
            {
                "purchaseOrderNumber": "TestOrder202",
                "sellingParty": {"partyId": "API01"},
                "acknowledgementDate": datetime.now(timezone.utc).isoformat(),
                "items": [
                    {
                        "vendorProductIdentifier": "028877454078",
                        "orderedQuantity": {"amount": 10},
                        "netCost": {"amount": "10.2"},
                        "itemAcknowledgements": [
                            {
                                "acknowledgementCode": "Accepted",
                                "acknowledgedQuantity": {"amount": 10},
                            }
                        ],
                    }
                ],
            }
        ]
    }
    response = vendor_orders_api.submit_acknowledgement(body=body)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    transaction_id = payload.get("transaction_id")
    if transaction_id:
        logger.info("Transaction ID: %s", transaction_id)
