"""
MCF (Fulfillment Outbound v2026-07-04) - Create & Track Order Recipe
====================================================================

This recipe demonstrates the standard "happy-path" MCF order flow:

1. **getOrderPreview** - Confirm how the order will ship (planned shipments), the estimated shipping weight, delivery/ship windows, and estimated fees before committing.
2. **createOrder**     - Submit the fulfillment order so Amazon ships the items from FBA inventory to the customer.
3. **listOrders**      - Retrieve recently updated orders (useful for reconciliation / confirming the order was accepted).
4. **getOrder**        - Retrieve the order to read its status and, once shipped, the per-package tracking details.

How tracking works in this version of APIs (important)
------------------------------------------------
There is no standalone "getPackageTrackingDetails" operation in this version. Package
tracking is embedded in the getOrder response at:
    order.shipments[].packages[].tracking.{carrier, amazon, proofOfDelivery}
Tracking values only populate once the order actually ships, so a freshly created order may not have tracking yet. For real-time, milestone-level
tracking, refer to TRACKING API - it is a different API model and out of scope for this recipe.

Real-world notes
----------------
- Steps 1 and 2 typically happen in quick succession at checkout.
- Prefer subscribing to the FULFILLMENT_ORDER_STATUS notification over polling getOrder, especially because createOrder may complete asynchronously.

DEVELOPER NOTES - Adapting this recipe for production
-----------------------------------------------------
1. Remove the ``oauth_endpoint`` and ``endpoint`` overrides in the API client property. The SDK routes to the correct SP-API endpoint by region.
2. Replace the placeholder SPAPIConfig credentials with your real LWA credentials, ideally loaded from environment variables.
3. Update the sample payloads in ``constants.py`` with real SKUs and addresses.

API version: Fulfillment Outbound v2026-07-04
SDK classes: spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_previews_api.FulfillmentPreviewsApi
             spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_orders_api.FulfillmentOrdersApi
"""

from typing import Any, Dict, List, Optional

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


class McfCreateAndTrackOrderRecipe(Recipe):
    """
    Orchestrates the end-to-end MCF order flow:
    preview -> create -> list -> get order (status + package tracking).
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
        """
        Call getOrderPreview to see how the order will ship, its estimated
        weight and delivery/ship windows, and the estimated fees before
        committing to createOrder.
        """
        print("[Step 1] Calling getOrderPreview...")
        response = self.previews_api.get_order_preview(body=self._preview_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 1] Order preview retrieved successfully.")
        return response

    # -- Step 2: Create Order --------------------------------------------------

    def create_order(self) -> Dict[str, Any]:
        """
        Call createOrder to submit the MCF order.
        """
        print("[Step 2] Calling createOrder...")
        response = self.orders_api.create_order(body=self._create_order_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print(f"[Step 2] Fulfillment order created: {self._create_order_request['orderId']}")
        return response

    # -- Step 3: List Orders ---------------------------------------------------

    def list_orders(self, updated_after: Optional[str] = None) -> Dict[str, Any]:
        """
        Call listOrders to retrieve recently updated orders. Handy for reconciliation or confirming an order was accepted.

        Query parameters:
        - updated_after : ISO 8601 timestamp; returns orders updated after it.
        - shipments     : "INCLUDE" (default) or "EXCLUDE" shipment data.
        - page_token    : from a prior response's pagination.nextToken.
        """
        updated_after = updated_after or constants.sample_list_orders_updated_after
        print(f"[Step 3] Calling listOrders (updatedAfter={updated_after})...")
        response = self.orders_api.list_orders(updated_after=updated_after)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 3] Orders listed successfully.")
        return response

    # -- Step 4: Get Order (status + package tracking) -------------------------

    def get_order(self, order_id: str) -> Dict[str, Any]:
        """
        Call getOrder to check the order status and, once shipped, read the
        per-package tracking details.

        Key fields in the response:
        - order.status (e.g., PROCESSING, COMPLETE, COMPLETE_PARTIAL, CANCELLED)
        - order.shipments[].status (PROCESSING, SHIPPED, CANCELLED)
        - order.shipments[].packages[].packageId
        - order.shipments[].packages[].status (PROCESSING, IN_TRANSIT, DELAYED, OUT_FOR_DELIVERY, DELIVERED, UNDELIVERABLE, EXPIRED)
        - order.shipments[].packages[].tracking.carrier.{carrierCode, trackingNumber, trackingUrl}
        - order.shipments[].packages[].tracking.amazon.{trackingNumber, trackingUrl}
        """
        print(f"[Step 4] Calling getOrder for {order_id}...")
        response = self.orders_api.get_order(order_id=order_id)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 4] Order details retrieved successfully.")
        return response


    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """
        Run the complete MCF happy-path workflow end to end.
        Data flows dynamically from one step to the next.
        """
        # Step 1 - Preview how the order will ship + fees
        preview = self.get_order_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 - Create the order
        create_response = self.create_order()
        order_id = self._create_order_request["orderId"]
        print("Create response (truncated):", str(create_response)[:500])

        # Step 3 - List recent orders (reconciliation)
        orders = self.list_orders()
        print("List orders (truncated):", str(orders)[:500])

        # Step 4 - Get order status and package tracking
        order = self.get_order(order_id)
        print("Order (truncated):", str(order)[:500])


        print("\n\u2705 MCF create and track order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateAndTrackOrderRecipe()
    recipe.start()
