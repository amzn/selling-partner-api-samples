"""
MCF (Fulfillment Outbound v2026-07-04) - Create & Cancel Order Recipe
=====================================================================

This recipe demonstrates creating an MCF order and then cancelling it before it is fulfilled:

1. **getOrderPreview** - Preview how the order will ship and its estimated fees.
2. **createOrder**     - Submit the fulfillment order.
3. **cancelOrder**     - Request that Amazon stop attempting to fulfill the order.

When cancellation succeeds?
--------------------------
Cancellation is only possible while the order has not yet entered fulfillment processing. Once items are picked/packed/shipped, a cancel request may be
rejected. Confirm the outcome by calling getOrder and checking that ``order.status`` is ``CANCELLED``.

DEVELOPER NOTES - Adapting this recipe for production
-----------------------------------------------------
1. Remove the ``oauth_endpoint`` and ``endpoint`` overrides in the API client property. The SDK routes to the correct SP-API endpoint by region.
2. Replace the placeholder SPAPIConfig credentials with your real LWA credentials, ideally loaded from environment variables.
3. Update the sample payloads in ``constants.py`` with real SKUs and addresses.

API version: Fulfillment Outbound v2026-07-04
SDK classes: spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_previews_api.FulfillmentPreviewsApi
             spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_orders_api.FulfillmentOrdersApi
"""

from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_previews_api import (
    FulfillmentPreviewsApi,
)
from spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_orders_api import (
    FulfillmentOrdersApi,
)

from src import config
from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2 import constants
from src.util.recipe import Recipe


class McfCreateAndCancelOrderRecipe(Recipe):
    """
    Orchestrates: preview -> create order -> cancel order.
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        previews_api: Optional[FulfillmentPreviewsApi] = None,
        orders_api: Optional[FulfillmentOrdersApi] = None,
        preview_request: Optional[Dict[str, Any]] = None,
        create_order_request: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(config=config)
        self._previews_api = previews_api
        self._orders_api = orders_api
        self._preview_request = preview_request or constants.sample_preview_request
        self._create_order_request = create_order_request or constants.sample_create_order_request

    # -- API client accessors --------------------------------------------------
    # DEVELOPER NOTE: For production, remove the oauth_endpoint and endpoint parameters below; the SDK selects the correct endpoint automatically.

    @property
    def previews_api(self) -> FulfillmentPreviewsApi:
        if self._previews_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._previews_api = FulfillmentPreviewsApi(client.api_client)
            print("Fulfillment Previews API client initialized successfully.")
        return self._previews_api

    @property
    def orders_api(self) -> FulfillmentOrdersApi:
        if self._orders_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._orders_api = FulfillmentOrdersApi(client.api_client)
            print("Fulfillment Orders API client initialized successfully.")
        return self._orders_api

    # -- Step 1: Get Order Preview ---------------------------------------------

    def get_order_preview(self) -> Dict[str, Any]:
        """Call getOrderPreview to preview shipment split, weight, and fees."""
        print("[Step 1] Calling getOrderPreview...")
        response = self.previews_api.get_order_preview(body=self._preview_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 1] Order preview retrieved successfully.")
        return response

    # -- Step 2: Create Order --------------------------------------------------

    def create_order(self) -> Dict[str, Any]:
        """Call createOrder to submit the MCF order (200/202 = accepted)."""
        print("[Step 2] Calling createOrder...")
        response = self.orders_api.create_order(body=self._create_order_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print(f"[Step 2] Fulfillment order created: {self._create_order_request['orderId']}")
        return response

    # -- Step 3: Cancel Order --------------------------------------------------

    def cancel_order(self, order_id: str) -> Dict[str, Any]:
        """
        Call cancelOrder to request Amazon stop fulfilling the order.

        Returns HTTP 202 (Accepted). Cancellation is best-effort: it only succeeds if the order has not yet entered fulfillment. Verify by calling
        getOrder and checking order.status == "CANCELLED".
        """
        print(f"[Step 3] Calling cancelOrder for {order_id}...")
        response = self.orders_api.cancel_order(order_id=order_id)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 3] Cancel request accepted.")
        return response

    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """Run the create-then-cancel workflow end to end."""
        # Step 1 - Preview
        preview = self.get_order_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 - Create the order
        create_response = self.create_order()
        order_id = self._create_order_request["orderId"]
        print("Create response (truncated):", str(create_response)[:500])

        # Step 3 - Cancel the order before fulfillment
        cancel_response = self.cancel_order(order_id)
        print("Cancel response (truncated):", str(cancel_response)[:500])

        print("\n\u2705 MCF create and cancel order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateAndCancelOrderRecipe()
    recipe.start()
