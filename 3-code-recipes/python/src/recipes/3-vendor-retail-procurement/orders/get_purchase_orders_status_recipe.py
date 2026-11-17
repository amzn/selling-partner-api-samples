"""
Vendor Orders API: Get Purchase Orders Status
==============================================

Retrieves purchase order statuses using the Vendor Orders API.
Supports querying by date range, specific PO number, or status.

Use cases:
- Check the current status of purchase orders (OPEN/CLOSED)
- Monitor order fulfillment progress
- Get item-level acknowledgement and receiving status

API operation: getPurchaseOrdersStatus
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetPurchaseOrdersStatusRecipe(Recipe):

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

    def get_order_status_by_date_range(
        self,
        updated_after: datetime,
        updated_before: datetime,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get purchase order statuses within a date range."""
        logger.info(
            "Fetching order statuses: updated_after=%s, updated_before=%s",
            updated_after.isoformat(),
            updated_before.isoformat(),
        )
        response = self.vendor_orders_api.get_purchase_orders_status(
            limit=limit,
            sort_order="DESC",
            updated_after=updated_after,
            updated_before=updated_before,
        )
        statuses = self._extract_statuses(response)
        logger.info("Found %d order statuses", len(statuses))
        return statuses

    def get_order_status_by_po_number(
        self, purchase_order_number: str
    ) -> Optional[Dict[str, Any]]:
        """Get status of a specific purchase order by PO number."""
        logger.info("Fetching status for PO: %s", purchase_order_number)
        response = self.vendor_orders_api.get_purchase_orders_status(
            limit=1,
            purchase_order_number=purchase_order_number,
        )
        statuses = self._extract_statuses(response)
        if statuses:
            logger.info("Found status for PO: %s", purchase_order_number)
            return statuses[0]
        logger.warning("No status found for PO: %s", purchase_order_number)
        return None

    def start(self) -> None:
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        statuses = self.get_order_status_by_date_range(
            updated_after=seven_days_ago,
            updated_before=now,
        )
        logger.info("Found %d order statuses", len(statuses))

        single_status = self.get_order_status_by_po_number("2JK3S9VC")
        if single_status:
            self._log_order_status(single_status)

    @staticmethod
    def _extract_statuses(response: Any) -> List[Dict[str, Any]]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("orders_status") or []

    @staticmethod
    def _log_order_status(status: Dict[str, Any]) -> None:
        logger.info("========================================")
        logger.info("Purchase Order Status")
        logger.info("========================================")
        logger.info("PO Number: %s", status.get("purchase_order_number"))
        logger.info("PO Status: %s", status.get("purchase_order_status"))
        item_statuses = status.get("item_status") or []
        logger.info("Item Statuses: %d items", len(item_statuses))
        for item in item_statuses:
            logger.info(
                "  - Seq: %s | ASIN: %s",
                item.get("item_sequence_number"),
                item.get("buyer_product_identifier"),
            )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetPurchaseOrdersStatusRecipe()
    recipe.start()
