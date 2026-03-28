"""
Multichannel Fulfillment (MCF) Create On-Hold and Ship Order Recipe
=====================================================================

This recipe demonstrates the on-hold order workflow in five steps:

1. **getFulfillmentPreview** – Check shipping options, estimated dates, and fees.
2. **createFulfillmentOrder** – Submit the order with fulfillmentAction=Hold so
   it is created but NOT shipped immediately.
3. **updateFulfillmentOrder** – Release the hold and request shipment by updating
   the fulfillmentAction to Ship.
4. **getFulfillmentOrder** – Poll the order to confirm it is now processing and
   retrieve package details.
5. **getPackageTrackingDetails** – Get carrier tracking info for each package.

Real-world notes
----------------
- The Hold action is useful when you need to validate payment, perform fraud
  checks, or wait for customer confirmation before shipping.
- Once you call updateFulfillmentOrder with fulfillmentAction=Ship, the order
  enters the normal fulfillment pipeline and cannot be held again.
- You can also use updateFulfillmentOrder to change the shipping address,
  shipping speed, or displayable order info while the order is on hold.

DEVELOPER NOTES — Adapting this recipe for production
-----------------------------------------------------
1. Remove the ``oauth_endpoint`` and ``endpoint`` overrides in the
   ``fba_outbound_api`` property. The SDK will automatically route to the
   correct SP-API endpoint based on your region (NA, EU, FE).
2. Replace the placeholder SPAPIConfig credentials with your real LWA
   credentials, ideally loaded from environment variables.
3. Update the sample payloads in ``constants.py`` with real addresses, SKUs,
   and order IDs from your seller account.

API version: Fulfillment Outbound v2020-07-01
SDK class:   spapi.api.fulfillment_outbound_v2020_07_01.FbaOutboundApi
"""

from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.fulfillment_outbound_v2020_07_01.fba_outbound_api import FbaOutboundApi

from src import config
from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1 import constants
from src.util.recipe import Recipe


class McfCreateOnHoldAndShipOrderRecipe(Recipe):
    """
    Orchestrates the MCF on-hold order flow:
    preview → create (Hold) → update (Ship) → get order → track package.

    Data flows dynamically between steps:
    - Step 2 creates the order in Hold state.
    - Step 3 releases the hold by updating fulfillmentAction to Ship.
    - Step 4 retrieves order status and package details.
    - Step 5 extracts packageNumber from Step 4 response.
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
        self._create_order_request = create_order_request or constants.sample_create_order_request_on_hold

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
        """
        print("[Step 1] Calling getFulfillmentPreview...")
        response = self.fba_outbound_api.get_fulfillment_preview(
            body=self._preview_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 1] Fulfillment preview retrieved successfully.")
        return response

    # -- Step 2: Create Fulfillment Order (on Hold) ----------------------------

    def create_fulfillment_order(self) -> Dict[str, Any]:
        """
        Call createFulfillmentOrder with fulfillmentAction=Hold.
        The order is created but NOT shipped until explicitly released.
        """
        print("[Step 2] Calling createFulfillmentOrder (Hold)...")
        response = self.fba_outbound_api.create_fulfillment_order(
            body=self._create_order_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print(
            f"[Step 2] Fulfillment order created on Hold: "
            f"{self._create_order_request['sellerFulfillmentOrderId']}"
        )
        return response

    # -- Step 3: Update Fulfillment Order (release hold, ship) -----------------

    def update_fulfillment_order(self, seller_fulfillment_order_id: str) -> Dict[str, Any]:
        """
        Call updateFulfillmentOrder to release the hold and request shipment.
        Sets fulfillmentAction to Ship so the order enters the fulfillment pipeline.
        """
        print(f"[Step 3] Calling updateFulfillmentOrder (Ship) for {seller_fulfillment_order_id}...")
        update_body = {
            "fulfillmentAction": "Ship",
        }
        response = self.fba_outbound_api.update_fulfillment_order(
            seller_fulfillment_order_id=seller_fulfillment_order_id,
            body=update_body,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 3] Order released from hold — shipment requested.")
        return response

    # -- Step 4: Get Fulfillment Order -----------------------------------------

    def get_fulfillment_order(self, seller_fulfillment_order_id: str) -> Dict[str, Any]:
        """
        Call getFulfillmentOrder to check the order status and retrieve
        package-level details (including packageNumber for tracking).
        """
        print(f"[Step 4] Calling getFulfillmentOrder for {seller_fulfillment_order_id}...")
        response = self.fba_outbound_api.get_fulfillment_order(
            seller_fulfillment_order_id=seller_fulfillment_order_id,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 4] Fulfillment order details retrieved successfully.")
        return response

    # -- Step 5: Get Package Tracking Details -----------------------------------

    def get_package_tracking_details(self, package_number: int) -> Dict[str, Any]:
        """
        Call getPackageTrackingDetails to get carrier and tracking info
        for a specific package.
        """
        print(f"[Step 5] Calling getPackageTrackingDetails for package {package_number}...")
        response = self.fba_outbound_api.get_package_tracking_details(
            package_number=package_number,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 5] Package tracking details retrieved successfully.")
        return response

    # -- Helper: extract package numbers from getFulfillmentOrder response ------

    @staticmethod
    def extract_package_numbers(order_response: Dict[str, Any]) -> List[int]:
        """
        Extract packageNumber values from the getFulfillmentOrder response.
        """
        shipments = (
            order_response
            .get("payload", {})
            .get("fulfillmentShipments", [])
        )
        package_numbers = []
        for shipment in shipments:
            for package in shipment.get("fulfillmentShipmentPackage", []):
                pkg_num = package.get("packageNumber")
                if pkg_num is not None:
                    package_numbers.append(int(pkg_num))
        return package_numbers

    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """
        Run the complete MCF on-hold order workflow end to end.
        Data flows dynamically from one step to the next.
        """
        # Step 1 – Preview shipping options
        preview = self.get_fulfillment_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 – Create order on Hold
        create_response = self.create_fulfillment_order()
        seller_order_id = self._create_order_request["sellerFulfillmentOrderId"]
        print("Create response (truncated):", str(create_response)[:500])

        # Step 3 – Release hold and ship
        update_response = self.update_fulfillment_order(seller_order_id)
        print("Update response (truncated):", str(update_response)[:500])

        # Step 4 – Get order status and package details
        order = self.get_fulfillment_order(seller_order_id)
        print("Order status (truncated):", str(order)[:500])

        # Step 5 – Track each package using packageNumbers from Step 4
        package_numbers = self.extract_package_numbers(order)
        if package_numbers:
            for pkg_num in package_numbers:
                tracking = self.get_package_tracking_details(pkg_num)
                print(f"Tracking for package {pkg_num} (truncated):", str(tracking)[:500])
        else:
            print("No packages found yet — order may still be processing.")

        print("\n✅ MCF create on-hold and ship order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateOnHoldAndShipOrderRecipe()
    recipe.start()
