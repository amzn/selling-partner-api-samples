"""
Vendor Orders API: Get Single Purchase Order
=============================================

Retrieves a specific purchase order by its purchase order number
using the Vendor Orders API.

Use cases:
- Get full details of a specific purchase order
- Verify order details before acknowledgement
- Look up order information for fulfillment processing

API operation: getPurchaseOrder
"""

import logging
from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetPurchaseOrderRecipe(Recipe):

    def __init__(
        self,
        sp_config: Optional[SPAPIConfig] = None,
        vendor_orders_api: Optional[VendorOrdersApi] = None,
    ) -> None:
        super().__init__(config=sp_config)
        self._vendor_orders_api = vendor_orders_api

    @property
    def vendor_orders_api(self) -> VendorOrdersApi:
        if self._vendor_orders_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._vendor_orders_api = VendorOrdersApi(client.api_client)
            logger.info("VendorOrdersApi client initialized")
        return self._vendor_orders_api

    def get_purchase_order(self, purchase_order_number: str) -> Optional[Dict[str, Any]]:
        """Get a specific purchase order by its purchase order number."""
        logger.info("Fetching purchase order: %s", purchase_order_number)
        response = self.vendor_orders_api.get_purchase_order(
            purchase_order_number=purchase_order_number,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload")
        if payload:
            logger.info("Successfully retrieved PO: %s", purchase_order_number)
            return payload
        logger.warning("No order found for PO: %s", purchase_order_number)
        return None

    def start(self) -> None:
        purchase_order_number = "4Z32PABC"
        order = self.get_purchase_order(purchase_order_number)
        if order:
            self._log_order_details(order)

    @staticmethod
    def _log_order_details(order: Dict[str, Any]) -> None:
        logger.info("========================================")
        logger.info("Purchase Order Details")
        logger.info("========================================")
        logger.info("PO Number: %s", order.get("purchase_order_number"))
        logger.info("State: %s", order.get("purchase_order_state"))
        details = order.get("order_details") or {}
        if details:
            logger.info("Order Date: %s", details.get("purchase_order_date"))
            logger.info("Order Type: %s", details.get("purchase_order_type"))
            logger.info("Payment Method: %s", details.get("payment_method"))
            logger.info("Ship Window: %s", details.get("ship_window"))
            selling_party = details.get("selling_party") or {}
            logger.info("Selling Party: %s", selling_party.get("party_id"))
            ship_to_party = details.get("ship_to_party") or {}
            logger.info("Ship To: %s", ship_to_party.get("party_id"))
            items = details.get("items") or []
            logger.info("Line Items (%d)", len(items))
            for item in items:
                ordered_qty = item.get("ordered_quantity") or {}
                net_cost = item.get("net_cost") or {}
                logger.info(
                    "  - Seq: %s | ASIN: %s | Qty: %s | Price: %s %s",
                    item.get("item_sequence_number"),
                    item.get("amazon_product_identifier"),
                    ordered_qty.get("amount", "N/A"),
                    net_cost.get("amount", "N/A"),
                    net_cost.get("currency_code", ""),
                )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetPurchaseOrderRecipe()
    recipe.start()
