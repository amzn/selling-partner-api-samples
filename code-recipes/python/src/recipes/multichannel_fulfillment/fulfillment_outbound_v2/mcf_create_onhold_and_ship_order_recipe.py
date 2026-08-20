"""
MCF (Fulfillment Outbound v2026-07-04) - Create On-Hold Order then Ship Recipe
==============================================================================

This recipe demonstrates creating an MCF order that is placed on hold (not shipped immediately) and later released for shipment:

1. **getOrderPreview** - Preview how the order will ship and its estimated fees.
2. **createOrder** (action = HOLD) - Submit the order without shipping it. The order is held until you explicitly release it.
3. **updateOrder** (action = SHIP) - Release the held order for shipment. 
4. **getOrder** - Confirm the order moved out of hold and read its status / shipments.

Why hold an order?
------------------
Holding is useful when you want to reserve fulfillment but defer shipment - for example, to allow a cancellation window, batch releases, or wait on a payment
or fraud check before the package leaves the fulfillment center. The order can be held for 14 days.

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


class McfCreateOnHoldAndShipOrderRecipe(Recipe):
    """
    Orchestrates: preview -> create order on HOLD -> update to SHIP -> get order.
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        previews_api: Optional[FulfillmentPreviewsApi] = None,
        orders_api: Optional[FulfillmentOrdersApi] = None,
        preview_request: Optional[Dict[str, Any]] = None,
        create_order_on_hold_request: Optional[Dict[str, Any]] = None,
        update_order_ship_request: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(config=config)
        self._previews_api = previews_api
        self._orders_api = orders_api
        self._preview_request = preview_request or constants.sample_preview_request
        self._create_order_on_hold_request = (
            create_order_on_hold_request or constants.sample_create_order_on_hold_request
        )
        self._update_order_ship_request = (
            update_order_ship_request or constants.sample_update_order_ship_request
        )

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

    # -- Step 2: Create Order on HOLD ------------------------------------------

    def create_order_on_hold(self) -> Dict[str, Any]:
        """
        Call createOrder with fulfillmentConfiguration.action = "HOLD" so the order is accepted and reserved, but NOT shipped yet.
        """
        print("[Step 2] Calling createOrder (action=HOLD)...")
        response = self.orders_api.create_order(body=self._create_order_on_hold_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print(
            f"[Step 2] On-hold order created: "
            f"{self._create_order_on_hold_request['orderId']}"
        )
        return response

    # -- Step 3: Update Order to SHIP ------------------------------------------

    def release_order_for_shipment(self, order_id: str) -> Dict[str, Any]:
        """
        Call updateOrder with fulfillmentConfiguration.action = "SHIP" to release the held order. In v2 only the action is required in the body - no need
        to resend the full order. Returns HTTP 202 Accepted.
        """
        print(f"[Step 3] Calling updateOrder (action=SHIP) for {order_id}...")
        response = self.orders_api.update_order(
            order_id=order_id,
            body=self._update_order_ship_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 3] Ship request accepted.")
        return response

    # -- Step 4: Get Order -----------------------------------------------------

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Call getOrder to confirm the order was released from hold and read its current status / shipments.
        """
        print(f"[Step 4] Calling getOrder for {order_id}...")
        response = self.orders_api.get_order(order_id=order_id)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 4] Order details retrieved successfully.")
        return response

    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """Run the create-on-hold then release-for-shipment workflow end to end."""
        # Step 1 - Preview
        preview = self.get_order_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 - Create the order on HOLD
        create_response = self.create_order_on_hold()
        order_id = self._create_order_on_hold_request["orderId"]
        print("Create (on hold) response (truncated):", str(create_response)[:500])

        # Step 3 - Release the held order for shipment
        update_response = self.release_order_for_shipment(order_id)
        print("Update (ship) response (truncated):", str(update_response)[:500])

        # Step 4 - Confirm status
        order = self.get_order(order_id)
        print("Order (truncated):", str(order)[:500])

        print("\n\u2705 MCF create on-hold and ship order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateOnHoldAndShipOrderRecipe()
    recipe.start()
