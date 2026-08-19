"""
Vendor Transaction Status API: Get Transaction
================================================

Checks the status of asynchronous POST transactions using the
Vendor Transaction Status API.

Use cases:
- Check if a submitAcknowledgement was processed successfully
- Check if a submitShipmentConfirmations was processed
- Check if a submitInvoices was processed
- Monitor async operation completion

API operation: getTransaction
"""

import logging
import time
from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.vendor_transaction_status_v1.vendor_transaction_api import VendorTransactionApi

from src import config
from src.util.recipe import Recipe

logger = logging.getLogger(__name__)


class GetTransactionRecipe(Recipe):

    def __init__(
        self,
        sp_config: Optional[SPAPIConfig] = None,
        vendor_transaction_api: Optional[VendorTransactionApi] = None,
    ) -> None:
        super().__init__(config=sp_config)
        self._vendor_transaction_api = vendor_transaction_api

    @property
    def vendor_transaction_api(self) -> VendorTransactionApi:
        if self._vendor_transaction_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._vendor_transaction_api = VendorTransactionApi(client.api_client)
            logger.info("VendorTransactionApi client initialized")
        return self._vendor_transaction_api

    def get_transaction_status(self, transaction_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a transaction by its ID."""
        logger.info("Fetching transaction status: %s", transaction_id)
        response = self.vendor_transaction_api.get_transaction(
            transaction_id=transaction_id,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        payload = response.get("payload") or {}
        transaction = payload.get("transaction_status")
        if transaction:
            logger.info("Retrieved status for transaction: %s", transaction_id)
            return transaction
        logger.warning("No status found for transaction: %s", transaction_id)
        return None

    def is_transaction_complete(self, transaction_id: str) -> bool:
        """Check if a transaction has completed (success or failure)."""
        transaction = self.get_transaction_status(transaction_id)
        if not transaction:
            return False
        status = transaction.get("status")
        return status in ("Success", "Failure")

    def is_transaction_successful(self, transaction_id: str) -> bool:
        """Check if a transaction was successful."""
        transaction = self.get_transaction_status(transaction_id)
        if not transaction:
            return False
        return transaction.get("status") == "Success"

    def poll_for_completion(
        self, transaction_id: str, max_attempts: int = 10, delay_seconds: float = 2.0
    ) -> Optional[Dict[str, Any]]:
        """Poll for transaction completion with timeout."""
        for attempt in range(1, max_attempts + 1):
            transaction = self.get_transaction_status(transaction_id)
            if transaction:
                status = transaction.get("status")
                logger.info(
                    "Attempt %d/%d: Transaction %s status = %s",
                    attempt, max_attempts, transaction_id, status,
                )
                if status in ("Success", "Failure"):
                    return transaction
            if attempt < max_attempts:
                time.sleep(delay_seconds)
        logger.warning(
            "Transaction %s did not complete within %d attempts",
            transaction_id, max_attempts,
        )
        return None

    def start(self) -> None:
        transaction_id = "20190904190535-eef8cad8-418e-4ed3-ac72-789e2ee6214a"
        transaction = self.get_transaction_status(transaction_id)
        if transaction:
            self._log_transaction_status(transaction)

    @staticmethod
    def _log_transaction_status(transaction: Dict[str, Any]) -> None:
        logger.info("========================================")
        logger.info("Transaction Status")
        logger.info("========================================")
        logger.info("Transaction ID: %s", transaction.get("transaction_id"))
        logger.info("Status: %s", transaction.get("status"))
        errors = transaction.get("errors") or []
        if errors:
            logger.info("Errors:")
            for error in errors:
                logger.info("  - Code: %s | Message: %s", error.get("code"), error.get("message"))


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    recipe = GetTransactionRecipe()
    recipe.start()
