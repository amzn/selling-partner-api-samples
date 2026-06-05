"""
Integration test for getTransaction — hits real SP-API endpoint.

Required environment variables:
- SP_API_CLIENT_ID
- SP_API_CLIENT_SECRET
- SP_API_REFRESH_TOKEN

Optional:
- SP_API_ENDPOINT (default: https://sellingpartnerapi-na.amazon.com)
- SP_API_TRANSACTION_ID (specific transaction to check)
"""

import logging
import os

import pytest
from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_transaction_status_v1.vendor_transaction_api import VendorTransactionApi

logger = logging.getLogger(__name__)

SP_API_ENDPOINT = os.environ.get("SP_API_ENDPOINT", "https://sellingpartnerapi-na.amazon.com")

pytestmark = pytest.mark.skipif(
    not os.environ.get("SP_API_CLIENT_ID"),
    reason="SP_API_CLIENT_ID not set — skipping integration test",
)


@pytest.fixture(scope="module")
def vendor_transaction_api():
    config = SPAPIConfig(
        client_id=os.environ["SP_API_CLIENT_ID"],
        client_secret=os.environ["SP_API_CLIENT_SECRET"],
        refresh_token=os.environ["SP_API_REFRESH_TOKEN"],
        region="NA",
    )
    client = SPAPIClient(config, endpoint=SP_API_ENDPOINT)
    api = VendorTransactionApi(client.api_client)
    logger.info("===========================================")
    logger.info("INTEGRATION TEST - getTransaction")
    logger.info("Endpoint: %s", SP_API_ENDPOINT)
    logger.info("===========================================")
    return api


def test_get_transaction(vendor_transaction_api):
    transaction_id = os.environ.get("SP_API_TRANSACTION_ID")
    if not transaction_id:
        logger.info("--- Skipping getTransaction (no SP_API_TRANSACTION_ID set) ---")
        pytest.skip("SP_API_TRANSACTION_ID not set")

    logger.info("--- Testing getTransaction (ID: %s) ---", transaction_id)
    response = vendor_transaction_api.get_transaction(transaction_id=transaction_id)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    transaction = payload.get("transaction_status")
    if transaction:
        logger.info("Transaction ID: %s", transaction.get("transaction_id"))
        logger.info("Status: %s", transaction.get("status"))
