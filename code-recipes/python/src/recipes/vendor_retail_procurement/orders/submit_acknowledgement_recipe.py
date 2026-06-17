"""
Vendor Orders API: Submit Acknowledgement
==========================================

Submits acknowledgements for purchase orders using the Vendor Orders API.
Vendors use this to accept or reject orders.

Use cases:
- Accept a purchase order fully
- Partially accept an order (accept some items, reject others)
- Reject an order with a reason code

API operation: submitAcknowledgement
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_orders_v1.vendor_orders_api import VendorOrdersApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class SubmitAcknowledgementRecipe(Recipe):

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

    def submit_order_acknowledgement(
        self,
        purchase_order_number: str,
        selling_party_id: str,
        vendor_product_id: str,
        ordered_quantity: int,
        accepted_quantity: int,
        net_cost_amount: str,
    ) -> Optional[str]:
        """Submit an acknowledgement to accept a purchase order."""
        logger.info("Submitting acknowledgement for PO: %s", purchase_order_number)
        body = {
            "acknowledgements": [
                {
                    "purchaseOrderNumber": purchase_order_number,
                    "sellingParty": {"partyId": selling_party_id},
                    "acknowledgementDate": datetime.now(timezone.utc).isoformat(),
                    "items": [
                        {
                            "vendorProductIdentifier": vendor_product_id,
                            "orderedQuantity": {"amount": ordered_quantity},
                            "netCost": {"amount": net_cost_amount},
                            "itemAcknowledgements": [
                                {
                                    "acknowledgementCode": "Accepted",
                                    "acknowledgedQuantity": {"amount": accepted_quantity},
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        response = self.vendor_orders_api.submit_acknowledgement(body=body)
        transaction_id = self._extract_transaction_id(response)
        if transaction_id:
            logger.info("Successfully submitted acknowledgement for PO: %s", purchase_order_number)
            logger.info("Transaction ID: %s", transaction_id)
        else:
            logger.warning("No transaction ID returned for PO: %s", purchase_order_number)
        return transaction_id

    def submit_order_rejection(
        self,
        purchase_order_number: str,
        selling_party_id: str,
        vendor_product_id: str,
        ordered_quantity: int,
        rejection_reason: str = "TemporarilyUnavailable",
    ) -> Optional[str]:
        """Submit a rejection for a purchase order item."""
        logger.info("Submitting rejection for PO: %s", purchase_order_number)
        body = {
            "acknowledgements": [
                {
                    "purchaseOrderNumber": purchase_order_number,
                    "sellingParty": {"partyId": selling_party_id},
                    "acknowledgementDate": datetime.now(timezone.utc).isoformat(),
                    "items": [
                        {
                            "vendorProductIdentifier": vendor_product_id,
                            "orderedQuantity": {"amount": ordered_quantity},
                            "itemAcknowledgements": [
                                {
                                    "acknowledgementCode": "Rejected",
                                    "rejectionReason": rejection_reason,
                                    "acknowledgedQuantity": {"amount": 0},
                                }
                            ],
                        }
                    ],
                }
            ]
        }
        response = self.vendor_orders_api.submit_acknowledgement(body=body)
        transaction_id = self._extract_transaction_id(response)
        if transaction_id:
            logger.info("Successfully submitted rejection for PO: %s", purchase_order_number)
        return transaction_id

    def start(self) -> None:
        transaction_id = self.submit_order_acknowledgement(
            purchase_order_number="TestOrder202",
            selling_party_id="API01",
            vendor_product_id="028877454078",
            ordered_quantity=10,
            accepted_quantity=10,
            net_cost_amount="10.2",
        )
        logger.info("Acknowledgement submitted. Transaction ID: %s", transaction_id)

    @staticmethod
    def _extract_transaction_id(response: Any) -> Optional[str]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("transaction_id")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = SubmitAcknowledgementRecipe()
    recipe.start()
