"""
Vendor Shipments API: Get Shipment Labels
==========================================

Retrieves shipping labels using the Vendor Shipments API.
Labels contain carrier information, tracking IDs, and label data (base64 encoded PDF).

Use cases:
- Download shipping labels for printing
- Get carrier codes and tracking information
- Retrieve labels by date range or shipment ID

API operation: getShipmentLabels
"""

import base64
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_shipments_v1.vendor_shipment_api import VendorShipmentApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetShipmentLabelsRecipe(Recipe):

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

    def get_labels_by_date_range(
        self,
        label_created_after: datetime,
        label_created_before: datetime,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get shipping labels created within a date range."""
        logger.info(
            "Fetching labels: created_after=%s, created_before=%s",
            label_created_after.isoformat(),
            label_created_before.isoformat(),
        )
        response = self.vendor_shipping_api.get_shipment_labels(
            limit=limit,
            sort_order="DESC",
            label_created_after=label_created_after,
            label_created_before=label_created_before,
        )
        labels = self._extract_labels(response)
        logger.info("Found %d labels", len(labels))
        return labels

    def get_labels_by_vendor_shipment_id(self, vendor_shipment_id: str) -> List[Dict[str, Any]]:
        """Get shipping labels by vendor shipment identifier."""
        logger.info("Fetching labels for vendor shipment: %s", vendor_shipment_id)
        response = self.vendor_shipping_api.get_shipment_labels(
            limit=50,
            vendor_shipment_identifier=vendor_shipment_id,
        )
        labels = self._extract_labels(response)
        logger.info("Found %d labels for vendor shipment: %s", len(labels), vendor_shipment_id)
        return labels

    def start(self) -> None:
        now = datetime.now(timezone.utc)
        seven_days_ago = now - timedelta(days=7)

        labels = self.get_labels_by_date_range(
            label_created_after=seven_days_ago,
            label_created_before=now,
        )
        logger.info("Found %d labels", len(labels))

        for label in labels:
            self._log_label_summary(label)

    @staticmethod
    def _extract_labels(response: Any) -> List[Dict[str, Any]]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("transport_labels") or []

    @staticmethod
    def _log_label_summary(label: Dict[str, Any]) -> None:
        logger.info("----------------------------------------")
        logger.info("Label Created: %s", label.get("label_create_date_time"))
        shipment_info = label.get("shipment_information") or {}
        if shipment_info:
            logger.info("Buyer Reference: %s", shipment_info.get("buyer_reference_number"))
            vendor_details = shipment_info.get("vendor_details") or {}
            logger.info("Vendor Shipment ID: %s", vendor_details.get("vendor_shipment_identifier"))
            ship_to = shipment_info.get("ship_to_party") or {}
            logger.info("Ship To: %s", ship_to.get("party_id"))

        label_data_list = label.get("label_data") or []
        logger.info("Label Data: %d labels available", len(label_data_list))
        for label_data in label_data_list:
            logger.info(
                "  - Tracking: %s | Carrier: %s | Format: %s",
                label_data.get("tracking_number"),
                label_data.get("carrier_code"),
                label_data.get("label_format"),
            )
            raw_label = label_data.get("label")
            if raw_label:
                pdf_bytes = base64.b64decode(raw_label)
                tracking = label_data.get("tracking_number") or "unknown"
                filename = f"label_{tracking}.pdf"
                file_path = Path(filename).resolve()
                file_path.write_bytes(pdf_bytes)
                logger.info("    Saved: %s (%d bytes)", file_path, len(pdf_bytes))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetShipmentLabelsRecipe()
    recipe.start()
