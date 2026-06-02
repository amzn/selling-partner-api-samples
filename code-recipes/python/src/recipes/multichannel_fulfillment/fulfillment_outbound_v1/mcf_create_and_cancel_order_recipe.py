"""
Multichannel Fulfillment (MCF) Create and Cancel Order Recipe
===============================================================

This recipe demonstrates the cancel order workflow in four steps:

1. **getFulfillmentPreview** – Check shipping options and fees.
2. **createFulfillmentOrder** – Submit the MCF order.
3. **cancelFulfillmentOrder** – Cancel the order before it ships.
4. **getFulfillmentOrder** – Confirm the order status is now CANCELLED.

Real-world notes
----------------
- Cancellation is only possible while the order is in a cancellable state
  (typically before it enters the shipping process).
- If the order has already shipped, cancelFulfillmentOrder will return an error.
- After cancelling, calling getFulfillmentOrder lets you verify the status
  changed to "CANCELLED" (or "CANCELLED_BY_SELLER").

DEVELOPER NOTES — Adapting this recipe for production
-----------------------------------------------------
1. Remove the ``oauth_endpoint`` and ``endpoint`` overrides in the
   ``fba_outbound_api`` property. The SDK will automatically route to the
   correct SP-API endpoint based on your region (NA, EU, FE).
2. Replace the placeholder SPAPIConfig credentials with your real LWA
   credentials, ideally loaded from environment variables::

       config = SPAPIConfig(
           client_id=os.environ["SP_API_CLIENT_ID"],
           client_secret=os.environ["SP_API_CLIENT_SECRET"],
           refresh_token=os.environ["SP_API_REFRESH_TOKEN"],
           region="NA",
       )

3. Update the sample payloads in ``constants.py`` with real addresses, SKUs,
   and order IDs from your seller account.

API version: Fulfillment Outbound v2020-07-01
SDK class:   spapi.api.fulfillment_outbound_v2020_07_01.FbaOutboundApi
"""

from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.fulfillment_outbound_v2020_07_01.fba_outbound_api import FbaOutboundApi

from src import config
from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1 import constants
from src.util.recipe import Recipe


class McfCreateAndCancelOrderRecipe(Recipe):
    """
    Orchestrates the MCF cancel order flow:
    preview → create → cancel → verify cancellation.

    Data flows dynamically between steps:
    - Step 2 uses the sellerFulfillmentOrderId from the create request.
    - Steps 3 and 4 use that same ID to cancel and verify.
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        fba_outbound_api: Optional[FbaOutboundApi] = None,
        preview_request: Optional[Dict[str, Any]] = None,
        create_order_request: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(config=config)
        self._fba_outbound_api = fba_outbound_api
        self._preview_request = preview_request or constants.sample_preview_request
        self._create_order_request = create_order_request or constants.sample_create_order_request

    # -- API client accessor ---------------------------------------------------
    # DEVELOPER NOTE: For production use, remove the oauth_endpoint and endpoint
    # parameters below. The SDK will use the correct SP-API endpoint automatically.

    @property
    def fba_outbound_api(self) -> FbaOutboundApi:
        if self._fba_outbound_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._fba_outbound_api = FbaOutboundApi(client.api_client)
            print("FBA Outbound API client initialized successfully.")
        return self._fba_outbound_api

    # -- Step 1: Get Fulfillment Preview ---------------------------------------

    def get_fulfillment_preview(self) -> Dict[str, Any]:
        """
        Call getFulfillmentPreview to see available shipping speeds,
        estimated delivery dates, and estimated fees.

        The response contains a list of FulfillmentPreview objects, each
        representing a different shipping speed option with its estimated
        arrival date and fulfillment fees.
        """
        print("[Step 1] Calling getFulfillmentPreview...")
        response = self.fba_outbound_api.get_fulfillment_preview(
            body=self._preview_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 1] Fulfillment preview retrieved successfully.")
        return response

    # -- Step 2: Create Fulfillment Order --------------------------------------

    def create_fulfillment_order(self) -> Dict[str, Any]:
        """
        Call createFulfillmentOrder to submit the MCF order.

        A successful response (HTTP 200) means the order was accepted.
        The sellerFulfillmentOrderId from the request is used in subsequent
        steps to cancel and verify the order.
        """
        print("[Step 2] Calling createFulfillmentOrder...")
        response = self.fba_outbound_api.create_fulfillment_order(
            body=self._create_order_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print(
            f"[Step 2] Fulfillment order created: "
            f"{self._create_order_request['sellerFulfillmentOrderId']}"
        )
        return response

    # -- Step 3: Cancel Fulfillment Order --------------------------------------

    def cancel_fulfillment_order(self, seller_fulfillment_order_id: str) -> Dict[str, Any]:
        """
        Call cancelFulfillmentOrder to cancel the order before it ships.

        Returns a CancelFulfillmentOrderResponse. A successful response
        (HTTP 200) means the cancellation request was accepted. Verify
        by calling getFulfillmentOrder in the next step.

        NOTE: This will fail if the order has already entered the shipping
        process. Handle the error accordingly in production.
        """
        print(f"[Step 3] Calling cancelFulfillmentOrder for {seller_fulfillment_order_id}...")
        response = self.fba_outbound_api.cancel_fulfillment_order(
            seller_fulfillment_order_id=seller_fulfillment_order_id,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 3] Fulfillment order cancelled successfully.")
        return response

    # -- Step 4: Get Fulfillment Order (verify cancellation) -------------------

    def get_fulfillment_order(self, seller_fulfillment_order_id: str) -> Dict[str, Any]:
        """
        Call getFulfillmentOrder to verify the order status after cancellation.

        After a successful cancel, the fulfillmentOrderStatus should be
        one of: "CANCELLED".
        """
        print(
            f"[Step 4] Calling getFulfillmentOrder to verify cancellation for "
            f"{seller_fulfillment_order_id}..."
        )
        response = self.fba_outbound_api.get_fulfillment_order(
            seller_fulfillment_order_id=seller_fulfillment_order_id,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 4] Fulfillment order details retrieved successfully.")
        return response

    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """
        Run the complete MCF cancel order workflow end to end.
        Data flows dynamically from one step to the next.
        """
        # Step 1 – Preview shipping options
        preview = self.get_fulfillment_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 – Create the order
        create_response = self.create_fulfillment_order()
        seller_order_id = self._create_order_request["sellerFulfillmentOrderId"]
        print("Create response (truncated):", str(create_response)[:500])

        # Step 3 – Cancel the order
        cancel_response = self.cancel_fulfillment_order(seller_order_id)
        print("Cancel response (truncated):", str(cancel_response)[:500])

        # Step 4 – Verify the order is cancelled
        order = self.get_fulfillment_order(seller_order_id)
        print("Order status (truncated):", str(order)[:500])

        print("\n✅ MCF create and cancel order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateAndCancelOrderRecipe()
    recipe.start()
