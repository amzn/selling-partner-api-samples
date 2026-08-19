"""
Vendor Orders API: Get Purchase Orders
=======================================

Retrieves purchase orders from Amazon using the Vendor Orders API.
Supports filtering by creation date, change date, state, and vendor code.

Use cases:
- Retrieve new purchase orders that need fulfillment
- Get orders modified since last sync (changed quantities, cancellations)
- Filter orders by state (New, Acknowledged, Closed)

API operation: getPurchaseOrders
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetPurchaseOrdersRecipe(Recipe):

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

    def get_purchase_orders_by_date_range(
        self,
        created_after: datetime,
        created_before: datetime,
        order_state: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get purchase orders created within a date range, optionally filtered by state."""
        logger.info(
            "Fetching orders: created_after=%s, created_before=%s, state=%s",
            created_after.isoformat(),
            created_before.isoformat(),
            order_state,
        )
        response = self.vendor_orders_api.get_purchase_orders(
            limit=limit,
            created_after=created_after,
            created_before=created_before,
            sort_order="DESC",
            include_details=True,
            purchase_order_state=order_state,
        )
        orders = self._extract_orders(response)
        logger.info("Found %d orders", len(orders))
        return orders

    def get_changed_purchase_orders(
        self,
        changed_after: datetime,
        changed_before: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get purchase orders that have been modified within a date range."""
        logger.info(
            "Fetching changed orders: changed_after=%s, changed_before=%s",
            changed_after.isoformat(),
            changed_before.isoformat(),
        )
        response = self.vendor_orders_api.get_purchase_orders(
            limit=limit,
            changed_after=changed_after,
            changed_before=changed_before,
            sort_order="DESC",
            include_details=True,
            is_po_changed=True,
        )
        orders = self._extract_orders(response)
        logger.info("Found %d changed orders", len(orders))
        return orders

    def start(self) -> None:
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        new_orders = self.get_purchase_orders_by_date_range(
            created_after=seven_days_ago,
            created_before=now,
            order_state="New",
        )
        logger.info("Found %d new orders", len(new_orders))

        changed_orders = self.get_changed_purchase_orders(
            changed_after=seven_days_ago,
            changed_before=now,
        )
        logger.info("Found %d changed orders", len(changed_orders))

        for order in new_orders:
            self._log_order_summary(order)

    @staticmethod
    def _extract_orders(response: Any) -> List[Dict[str, Any]]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("orders") or []

    @staticmethod
    def _log_order_summary(order: Dict[str, Any]) -> None:
        logger.info("----------------------------------------")
        logger.info("PO Number: %s", order.get("purchase_order_number"))
        logger.info("State: %s", order.get("purchase_order_state"))
        details = order.get("order_details") or {}
        if details:
            logger.info("Order Date: %s", details.get("purchase_order_date"))
            logger.info("Ship Window: %s", details.get("ship_window"))
            items = details.get("items") or []
            logger.info("Items: %d", len(items))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetPurchaseOrdersRecipe()
    recipe.start()
