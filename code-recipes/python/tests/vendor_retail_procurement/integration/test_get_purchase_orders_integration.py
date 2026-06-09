"""
Integration test for Vendor Orders API — makes REAL SP-API calls.

Required environment variables:
- SP_API_CLIENT_ID
- SP_API_CLIENT_SECRET
- SP_API_REFRESH_TOKEN

Optional:
- SP_API_ENDPOINT (default: https://sellingpartnerapi-na.amazon.com)
- SP_API_PURCHASE_ORDER (specific PO number for single-order test)
- SP_API_VENDOR_CODE (vendor code filter)
"""

import logging
import os
from datetime import datetime, timedelta, timezone

import pytest
from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

logger = logging.getLogger(__name__)

SP_API_ENDPOINT = os.environ.get("SP_API_ENDPOINT", "https://sellingpartnerapi-na.amazon.com")

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
    client = SPAPIClient(config, endpoint=SP_API_ENDPOINT)
    api = VendorOrdersApi(client.api_client)
    logger.info("===========================================")
    logger.info("INTEGRATION TEST - Real SP-API Calls")
    logger.info("Endpoint: %s", SP_API_ENDPOINT)
    logger.info("===========================================")
    return api


def test_get_purchase_orders(vendor_orders_api):
    logger.info("--- Testing getPurchaseOrders (date range) ---")
    now = datetime.now(timezone.utc)
    response = vendor_orders_api.get_purchase_orders(
        limit=10,
        created_after=now - timedelta(days=7),
        created_before=now,
    )
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    orders = payload.get("orders") or []
    logger.info("Found %d orders", len(orders))
    for order in orders:
        logger.info("  PO: %s | State: %s",
                    order.get("purchase_order_number"),
                    order.get("purchase_order_state"))


def test_get_purchase_order(vendor_orders_api):
    # Use env var if provided, otherwise grab the first PO from getPurchaseOrders
    po_number = os.environ.get("SP_API_PURCHASE_ORDER")
    if not po_number:
        from datetime import timedelta
        now = datetime.now(timezone.utc)
        list_response = vendor_orders_api.get_purchase_orders(
            limit=1,
            created_after=now - timedelta(days=7),
            created_before=now,
        )
        if hasattr(list_response, "to_dict"):
            list_response = list_response.to_dict()
        orders = (list_response.get("payload") or {}).get("orders") or []
        if not orders:
            pytest.skip("No orders found to test getPurchaseOrder")
        po_number = orders[0].get("purchase_order_number")

    logger.info("--- Testing getPurchaseOrder (single PO: %s) ---", po_number)
    response = vendor_orders_api.get_purchase_order(purchase_order_number=po_number)
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    logger.info("PO Number: %s", payload.get("purchase_order_number"))
    logger.info("State: %s", payload.get("purchase_order_state"))
    details = payload.get("order_details") or {}
    if details:
        logger.info("Order Date: %s", details.get("purchase_order_date"))
        logger.info("Order Type: %s", details.get("purchase_order_type"))
        logger.info("Ship Window: %s", details.get("ship_window"))
        selling_party = details.get("selling_party") or {}
        logger.info("Selling Party: %s", selling_party.get("party_id"))
        items = details.get("items") or []
        logger.info("Items: %d", len(items))
        for item in items:
            ordered_qty = item.get("ordered_quantity") or {}
            logger.info("  - ASIN: %s | Qty: %s",
                        item.get("amazon_product_identifier"),
                        ordered_qty.get("amount"))


def test_get_purchase_orders_status(vendor_orders_api):
    logger.info("--- Testing getPurchaseOrdersStatus ---")
    now = datetime.now(timezone.utc)
    response = vendor_orders_api.get_purchase_orders_status(
        limit=10,
        sort_order="DESC",
        updated_after=now - timedelta(days=7),
        updated_before=now,
    )
    if hasattr(response, "to_dict"):
        response = response.to_dict()
    payload = response.get("payload") or {}
    statuses = payload.get("orders_status") or []
    logger.info("Found %d order statuses", len(statuses))
    for status in statuses:
        logger.info("  PO: %s | Status: %s",
                    status.get("purchase_order_number"),
                    status.get("purchase_order_status"))
