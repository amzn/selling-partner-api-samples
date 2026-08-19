"""
Vendor Shipments API: Submit Shipments
=======================================

Submits shipment requests for vendor orders. Use to create, update, or cancel shipments.

Use cases:
- Create new shipment requests
- Update existing shipment information
- Cancel shipments

API operation: submitShipments
"""

import logging
from datetime import datetime, timezone
from typing import Any, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_shipments_v1.vendor_shipment_api import VendorShipmentApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class SubmitShipmentsRecipe(Recipe):

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

    def submit_shipment(
        self,
        vendor_shipment_id: str,
        buyer_reference_number: str,
        selling_party_id: str,
        ship_from_party_id: str,
        ship_to_party_id: str,
        purchase_orders: list,
    ) -> Optional[str]:
        """Submit a shipment request."""
        logger.info("Submitting shipment: %s", vendor_shipment_id)
        body = {
            "shipments": [
                {
                    "vendorShipmentIdentifier": vendor_shipment_id,
                    "buyerReferenceNumber": buyer_reference_number,
                    "transactionType": "New",
                    "transactionDate": datetime.now(timezone.utc).isoformat(),
                    "shipmentFreightTerm": "Collect",
                    "sellingParty": {"partyId": selling_party_id},
                    "shipFromParty": {
                        "partyId": ship_from_party_id,
                        "address": {
                            "name": "ABC electronics warehouse",
                            "addressLine1": "DEF 1st street",
                            "city": "Lisses",
                            "stateOrRegion": "abcland",
                            "postalCode": "91090",
                            "countryCode": "DE",
                        },
                    },
                    "shipToParty": {"partyId": ship_to_party_id},
                    "shipmentMeasurements": {
                        "totalCartonCount": 30,
                        "totalPalletStackable": 30,
                        "totalPalletNonStackable": 30,
                    },
                    "purchaseOrders": purchase_orders,
                }
            ]
        }
        response = self.vendor_shipping_api.submit_shipments(body=body)
        transaction_id = self._extract_transaction_id(response)
        if transaction_id:
            logger.info("Shipment submitted successfully")
            logger.info("Transaction ID: %s", transaction_id)
        return transaction_id

    def start(self) -> None:
        purchase_orders = [
            {
                "purchaseOrderNumber": "1BBBAAAA",
                "items": [
                    {
                        "itemSequenceNumber": "001",
                        "vendorProductIdentifier": "9782700001659",
                        "shippedQuantity": {"amount": 100, "unitOfMeasure": "Eaches"},
                    }
                ],
            }
        ]
        transaction_id = self.submit_shipment(
            vendor_shipment_id="00050003",
            buyer_reference_number="1234567",
            selling_party_id="PQRSS",
            ship_from_party_id="999US",
            ship_to_party_id="ABCDF",
            purchase_orders=purchase_orders,
        )
        logger.info("Shipment submitted. Transaction ID: %s", transaction_id)

    @staticmethod
    def _extract_transaction_id(response: Any) -> Optional[str]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("transaction_id")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = SubmitShipmentsRecipe()
    recipe.start()
