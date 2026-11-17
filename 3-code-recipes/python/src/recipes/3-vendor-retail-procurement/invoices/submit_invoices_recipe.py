"""
Vendor Invoices API: Submit Invoices
=====================================

Submits invoices or credit notes to Amazon.

Use cases:
- Submit invoices for shipped goods
- Submit credit notes for returns or adjustments

API operation: submitInvoices
"""

import logging
from typing import Any, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_invoices_v1.vendor_payments_api import VendorPaymentsApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class SubmitInvoicesRecipe(Recipe):

    def __init__(
        self,
        sp_config: Optional[SPAPIConfig] = None,
        vendor_payments_api: Optional[VendorPaymentsApi] = None,
    ) -> None:
        super().__init__(config=sp_config)
        self._vendor_payments_api = vendor_payments_api

    @property
    def vendor_payments_api(self) -> VendorPaymentsApi:
        if self._vendor_payments_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._vendor_payments_api = VendorPaymentsApi(client.api_client)
            logger.info("VendorPaymentsApi client initialized")
        return self._vendor_payments_api

    def submit_invoice(
        self,
        invoice_id: str,
        invoice_type: str,
        invoice_date: str,
        remit_to_party_id: str,
        bill_to_party_id: str,
        invoice_total_amount: str,
        invoice_total_currency: str,
    ) -> Optional[str]:
        """Submit an invoice."""
        logger.info("Submitting invoice: %s", invoice_id)
        body = {
            "invoices": [
                {
                    "id": invoice_id,
                    "invoiceType": invoice_type,
                    "date": invoice_date,
                    "remitToParty": {"partyId": remit_to_party_id},
                    "billToParty": {"partyId": bill_to_party_id},
                    "invoiceTotal": {
                        "amount": invoice_total_amount,
                        "currencyCode": invoice_total_currency,
                    },
                }
            ]
        }
        response = self.vendor_payments_api.submit_invoices(body=body)
        transaction_id = self._extract_transaction_id(response)
        if transaction_id:
            logger.info("Invoice submitted successfully")
            logger.info("Transaction ID: %s", transaction_id)
        return transaction_id

    def start(self) -> None:
        transaction_id = self.submit_invoice(
            invoice_id="TestInvoice202",
            invoice_type="Invoice",
            invoice_date="2020-06-08T12:00:00.000Z",
            remit_to_party_id="ABCDE",
            bill_to_party_id="TES1",
            invoice_total_amount="112.05",
            invoice_total_currency="USD",
        )
        logger.info("Invoice submitted. Transaction ID: %s", transaction_id)

    @staticmethod
    def _extract_transaction_id(response: Any) -> Optional[str]:
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        return payload.get("transaction_id")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = SubmitInvoicesRecipe()
    recipe.start()
