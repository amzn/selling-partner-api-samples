"""
Integration test for submitInvoices — uses SANDBOX endpoint.

Required environment variables:
- SP_API_CLIENT_ID
- SP_API_CLIENT_SECRET
- SP_API_REFRESH_TOKEN
"""

import logging
import os

import pytest
from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_invoices_v1.vendor_payments_api import VendorPaymentsApi

logger = logging.getLogger(__name__)

SANDBOX_ENDPOINT = "https://sandbox.sellingpartnerapi-na.amazon.com"

pytestmark = pytest.mark.skipif(
    not os.environ.get("SP_API_CLIENT_ID"),
    reason="SP_API_CLIENT_ID not set — skipping integration test",
)


@pytest.fixture(scope="module")
def vendor_payments_api():
    config = SPAPIConfig(
        client_id=os.environ["SP_API_CLIENT_ID"],
        client_secret=os.environ["SP_API_CLIENT_SECRET"],
        refresh_token=os.environ["SP_API_REFRESH_TOKEN"],
        region="NA",
    )
    client = SPAPIClient(config, endpoint=SANDBOX_ENDPOINT)
    api = VendorPaymentsApi(client.api_client)
    logger.info("===========================================")
    logger.info("SANDBOX TEST - submitInvoices")
    logger.info("Endpoint: %s", SANDBOX_ENDPOINT)
    logger.info("===========================================")
    return api


def test_submit_invoices(vendor_payments_api):
    logger.info("--- Testing submitInvoices (sandbox) ---")

    # Values below are required by SP-API static sandbox — the sandbox only returns
    # a valid response when the request matches this exact payload.
    body = {
        "invoices": [
            {
                "id": "TestInvoice202",
                "invoiceType": "Invoice",
                "date": "2020-06-08T12:00:00.000Z",
                "remitToParty": {"partyId": "ABCDE"},
                "billToParty": {"partyId": "TES1"},
                "invoiceTotal": {
                    "amount": "112.05",
                    "currencyCode": "USD",
                },
            }
        ]
    }
    response = vendor_payments_api.submit_invoices(body=body)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    transaction_id = payload.get("transaction_id")
    if transaction_id:
        logger.info("Transaction ID: %s", transaction_id)
