"""
Multichannel Fulfillment (MCF) Create and Track Order Recipe
==============================================================

This recipe demonstrates the standard happy-path MCF workflow in four steps:

1. **getFulfillmentPreview** – Check shipping options, estimated dates, and fees
   before committing to an order.
2. **createFulfillmentOrder** – Submit the fulfillment order so Amazon ships the
   items from FBA inventory to the customer.
3. **getFulfillmentOrder** – Poll the order to confirm it was accepted and
   retrieve its current status and package details.
4. **getPackageTrackingDetails** – Get carrier tracking information for a
   specific package in the shipment.

Real-world notes
----------------
- Steps 1 and 2 typically happen in quick succession when a customer checks out.
- Step 3 can be called repeatedly (polling) or replaced by subscribing to the
  FULFILLMENT_ORDER_STATUS notification via the Notifications API.
- Step 4 requires a ``packageNumber`` which is extracted from the Step 3 response.

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

from typing import Any, Dict, List, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.fulfillment_outbound_v2020_07_01.fba_outbound_api import FbaOutboundApi

from src import config
from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1 import constants
from src.util.recipe import Recipe


class McfCreateAndTrackOrderRecipe(Recipe):
    """
    Orchestrates the end-to-end MCF order flow:
    preview → create → get order → track package.

    Data flows dynamically between steps:
    - Step 2 uses the sellerFulfillmentOrderId from the create request.
    - Step 3 uses that same ID to retrieve order details.
    - Step 4 extracts packageNumber from the Step 3 response.
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
            response = response.to_dict()
        print("[Step 1] Fulfillment preview retrieved successfully.")
        return response

    # -- Step 2: Create Fulfillment Order --------------------------------------

    def create_fulfillment_order(self) -> Dict[str, Any]:
        """
        Call createFulfillmentOrder to submit the MCF order.

        A successful response (HTTP 200) means the order was accepted.
        The sellerFulfillmentOrderId from the request is used in subsequent
        steps to check status and track packages.
        """
        print("[Step 2] Calling createFulfillmentOrder...")
        response = self.fba_outbound_api.create_fulfillment_order(
            body=self._create_order_request,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print(
            f"[Step 2] Fulfillment order created: "
            f"{self._create_order_request['sellerFulfillmentOrderId']}"
        )
        return response

    # -- Step 3: Get Fulfillment Order -----------------------------------------

    def get_fulfillment_order(self, seller_fulfillment_order_id: str) -> Dict[str, Any]:
        """
        Call getFulfillmentOrder to check the order status and retrieve
        package-level details (including packageNumber for tracking).

        Key fields in the response:
        - payload.fulfillmentOrder.fulfillmentOrderStatus (e.g., PLANNING, PROCESSING, COMPLETE)
        - payload.fulfillmentShipments[].fulfillmentShipmentPackage[].packageNumber
        """
        print(f"[Step 3] Calling getFulfillmentOrder for {seller_fulfillment_order_id}...")
        response = self.fba_outbound_api.get_fulfillment_order(
            seller_fulfillment_order_id=seller_fulfillment_order_id,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 3] Fulfillment order details retrieved successfully.")
        return response

    # -- Step 4: Get Package Tracking Details -----------------------------------

    def get_package_tracking_details(self, package_number: int) -> Dict[str, Any]:
        """
        Call getPackageTrackingDetails to get carrier and tracking info
        for a specific package.

        Key fields in the response:
        - payload.packageNumber
        - payload.trackingNumber (carrier tracking ID)
        - payload.carrierCode (e.g., "UPS", "USPS", "AMZN_US")
        - payload.trackingEvents[] (shipment milestone events)
        """
        print(f"[Step 4] Calling getPackageTrackingDetails for package {package_number}...")
        response = self.fba_outbound_api.get_package_tracking_details(
            package_number=package_number,
        )
        if hasattr(response, "to_dict"):
            response = response.to_dict()
        print("[Step 4] Package tracking details retrieved successfully.")
        return response

    # -- Helper: extract package numbers from getFulfillmentOrder response ------

    @staticmethod
    def extract_package_numbers(order_response: Dict[str, Any]) -> List[int]:
        """
        Extract packageNumber values from the getFulfillmentOrder response.
        These are needed to call getPackageTrackingDetails.

        The packageNumber lives at:
        payload.fulfillmentShipments[].fulfillmentShipmentPackage[].packageNumber
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
        Run the complete MCF happy-path workflow end to end.
        Data flows dynamically from one step to the next.
        """
        # Step 1 – Preview shipping options
        preview = self.get_fulfillment_preview()
        print("Preview (truncated):", str(preview)[:500])

        # Step 2 – Create the order
        create_response = self.create_fulfillment_order()
        seller_order_id = self._create_order_request["sellerFulfillmentOrderId"]
        print("Create response (truncated):", str(create_response)[:500])

        # Step 3 – Get order status and package details
        order = self.get_fulfillment_order(seller_order_id)
        print("Order status (truncated):", str(order)[:500])

        # Step 4 – Track each package using packageNumbers from Step 3
        package_numbers = self.extract_package_numbers(order)
        if package_numbers:
            for pkg_num in package_numbers:
                tracking = self.get_package_tracking_details(pkg_num)
                print(f"Tracking for package {pkg_num} (truncated):", str(tracking)[:500])
        else:
            print("No packages found yet — order may still be processing.")

        print("\n✅ MCF create and track order workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfCreateAndTrackOrderRecipe()
    recipe.start()
