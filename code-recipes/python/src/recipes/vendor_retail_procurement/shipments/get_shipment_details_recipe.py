"""
Vendor Shipments API: Get Shipment Details
===========================================

Retrieves shipment details using the Vendor Shipments API.
Supports filtering by date ranges, shipment status, vendor shipment ID,
and buyer reference number.

Use cases:
- Track shipment status and carrier information
- Get container details and tracking numbers
- Monitor delivery progress
- Retrieve shipment confirmations

API operation: getShipmentDetails
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_shipments_v1.vendor_shipment_api import VendorShipmentApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetShipmentDetailsRecipe(Recipe):

    def __init__(
        self,
        sp_config: Optional[SPAPIConfig] = None,
        vendor_shipping_api: Optional[VendorShipmentApi] = None,
    ) -> None:
        super().__init__(config=sp_config)
        self._vendor_shipping_api = vendor_shipping_api

    @property
    def vendor_shipping_api(self) -> VendorShipmentApi:
        if self._vendor_shipping_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._vendor_shipping_api = VendorShipmentApi(client.api_client)
            logger.info("VendorShipmentApi client initialized")
        return self._vendor_shipping_api

    def get_shipments_by_date_range(
        self,
        created_after: datetime,
        created_before: datetime,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get shipment details created within a date range."""
        logger.info(
            "Fetching shipments: created_after=%s, created_before=%s",
            created_after.isoformat(),
            created_before.isoformat(),
        )
        response = self.vendor_shipping_api.get_shipment_details(
            limit=limit,
            sort_order="DESC",
            created_after=created_after,
            created_before=created_before,
        )
        shipments = self._extract_shipments(response)
        logger.info("Found %d shipments", len(shipments))
        return shipments

    def get_shipment_by_vendor_id(self, vendor_shipment_id: str) -> Optional[Dict[str, Any]]:
        """Get shipment details by vendor shipment identifier."""
        logger.info("Fetching shipment by vendor ID: %s", vendor_shipment_id)
        response = self.vendor_shipping_api.get_shipment_details(
            limit=1,
            vendor_shipment_identifier=vendor_shipment_id,
        )
        shipments = self._extract_shipments(response)
        if shipments:
            logger.info("Found shipment for vendor ID: %s", vendor_shipment_id)
            return shipments[0]
        logger.warning("No shipment found for vendor ID: %s", vendor_shipment_id)
        return None

    def get_shipment_by_buyer_reference(self, buyer_reference_number: str) -> Optional[Dict[str, Any]]:
        """Get shipment details by buyer reference number."""
        logger.info("Fetching shipment by buyer reference: %s", buyer_reference_number)
        response = self.vendor_shipping_api.get_shipment_details(
            limit=1,
            buyer_reference_number=buyer_reference_number,
        )
        shipments = self._extract_shipments(response)
        if shipments:
            logger.info("Found shipment for buyer reference: %s", buyer_reference_number)
            return shipments[0]
        logger.warning("No shipment found for buyer reference: %s", buyer_reference_number)
        return None

    def start(self) -> None:
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        shipments = self.get_shipments_by_date_range(
            created_after=seven_days_ago,
            created_before=now,
        )
        logger.info("Found %d shipments", len(shipments))

        for shipment in shipments:
            self._log_shipment_summary(shipment)

    @staticmethod
    def _extract_shipments(response: Any) -> List[Dict[str, Any]]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("shipments") or []

    @staticmethod
    def _log_shipment_summary(shipment: Dict[str, Any]) -> None:
        logger.info("----------------------------------------")
        logger.info("Vendor Shipment ID: %s", shipment.get("vendor_shipment_identifier"))
        logger.info("Buyer Reference: %s", shipment.get("buyer_reference_number"))
        logger.info("Status: %s", shipment.get("current_shipment_status"))
        logger.info("Transaction Type: %s", shipment.get("transaction_type"))
        selling_party = shipment.get("selling_party") or {}
        logger.info("Selling Party: %s", selling_party.get("party_id"))
        ship_to_party = shipment.get("ship_to_party") or {}
        logger.info("Ship To: %s", ship_to_party.get("party_id"))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetShipmentDetailsRecipe()
    recipe.start()
