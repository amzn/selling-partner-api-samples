"""
Vendor Shipments API: Submit Shipment Confirmation
===================================================

Submits shipment confirmations to notify Amazon that items have been shipped.

Use cases:
- Confirm shipment of items from a purchase order
- Provide tracking information and carrier details
- Update Amazon on shipped quantities and packaging

API operation: submitShipmentConfirmations
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_shipments_v1.vendor_shipment_api import VendorShipmentApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class SubmitShipmentConfirmationRecipe(Recipe):

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

    def submit_shipment_confirmation(
        self,
        shipment_identifier: str,
        selling_party_id: str,
        ship_from_party_id: str,
        ship_to_party_id: str,
        items: list,
    ) -> Optional[str]:
        """Submit a shipment confirmation."""
        logger.info("Submitting shipment confirmation: %s", shipment_identifier)
        body = {
            "shipmentConfirmations": [
                {
                    "shipmentIdentifier": shipment_identifier,
                    "shipmentConfirmationDate": datetime.now(timezone.utc).isoformat(),
                    "sellingParty": {"partyId": selling_party_id},
                    "shipFromParty": {"partyId": ship_from_party_id},
                    "shipToParty": {"partyId": ship_to_party_id},
                    "shipmentConfirmationType": "Original",
                    "shippedItems": items,
                }
            ]
        }
        response = self.vendor_shipping_api.submit_shipment_confirmations(body=body)
        transaction_id = self._extract_transaction_id(response)
        if transaction_id:
            logger.info("Shipment confirmation submitted successfully")
            logger.info("Transaction ID: %s", transaction_id)
        return transaction_id

    def start(self) -> None:
        items = [
            {
                "itemSequenceNumber": "001",
                "shippedQuantity": {"amount": 100, "unitOfMeasure": "Eaches"},
            },
            {
                "itemSequenceNumber": "002",
                "shippedQuantity": {"amount": 100, "unitOfMeasure": "Cases"},
            },
        ]
        transaction_id = self.submit_shipment_confirmation(
            shipment_identifier="TestShipmentConfirmation202",
            selling_party_id="ABCD1",
            ship_from_party_id="EFGH1",
            ship_to_party_id="JKL1",
            items=items,
        )
        logger.info("Shipment confirmation submitted. Transaction ID: %s", transaction_id)

    @staticmethod
    def _extract_transaction_id(response: Any) -> Optional[str]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("transaction_id")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = SubmitShipmentConfirmationRecipe()
    recipe.start()
