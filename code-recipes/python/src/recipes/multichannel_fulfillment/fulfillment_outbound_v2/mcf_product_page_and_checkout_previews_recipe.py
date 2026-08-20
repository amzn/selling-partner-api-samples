"""
MCF (Fulfillment Outbound v2026-07-04) - Product Page & Checkout Previews Recipe 
==============================================================================

This recipe demonstrates the two pre-order "preview" calls in this API and when to use each. They answer different questions at different points in the shopper funnel:

1. **getOffers** (product/cart page) - "When can the customer get it?"
   Item-level delivery promise with an estimated delivery date range and an offer expiry. Works with a variable-precision address (postal code + country)
   or even just the shopper's IP. Fast and lightweight and this operation does not return any estimated fees associated with the MCF order.

2. **getOrderPreview** (checkout review) - "How will it ship and what will it cost?" 
   Order-level preview that requires a full delivery address and returns planned shipments (how the order splits), estimated shipping weight,
   delivery/ship intervals, and estimated fees.

Real-world notes
----------------
- Show ``getOffers`` results as a "Get it by <date>" badge early, at scale.
- Call ``getOrderPreview`` once, at checkout, when you have the full address, to show shipment breakdown and fees before committing the order.
- Neither call reserves inventory or creates an order.

DEVELOPER NOTES - Adapting this recipe for production
-----------------------------------------------------
1. Remove the ``oauth_endpoint`` and ``endpoint`` overrides in the API client properties. The SDK routes to the correct SP-API endpoint by region.
2. Replace the placeholder SPAPIConfig credentials with your real LWA credentials, ideally loaded from environment variables.
3. Update the sample payloads in ``constants.py`` with real SKUs and addresses.

API version: Fulfillment Outbound v2026-07-04
SDK classes: spapi.api.fulfillment_outbound_v2026_07_04.offers_api.OffersApi
             spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_previews_api.FulfillmentPreviewsApi
"""

from typing import Any, Dict, Optional

from spapi import SPAPIClient, SPAPIConfig
from spapi.api.fulfillment_outbound_v2026_07_04.offers_api import OffersApi
from spapi.api.fulfillment_outbound_v2026_07_04.fulfillment_previews_api import (
    FulfillmentPreviewsApi,
)

from src import config
from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2 import constants
from src.util.recipe import Recipe


class McfProductPageAndCheckoutPreviewsRecipe(Recipe):
    """
    Bundles the two v2 pre-order preview calls:
    getOffers (delivery promise) -> getOrderPreview (shipment split + fees).
    """

    def __init__(
        self,
        config: Optional[SPAPIConfig] = None,
        offers_api: Optional[OffersApi] = None,
        previews_api: Optional[FulfillmentPreviewsApi] = None,
        offers_request: Optional[Dict[str, Any]] = None,
        preview_request: Optional[Dict[str, Any]] = None,
    ) -> None:
        super().__init__(config=config)
        self._offers_api = offers_api
        self._previews_api = previews_api
        self._offers_request = offers_request or constants.sample_offers_request
        self._preview_request = preview_request or constants.sample_preview_request

    # -- API client accessors --------------------------------------------------
    # DEVELOPER NOTE: For production, remove the oauth_endpoint and endpoint parameters below; the SDK selects the correct endpoint automatically.

    @property
    def offers_api(self) -> OffersApi:
        if self._offers_api is None:
            client = SPAPIClient(
                self.config,
                oauth_endpoint=f"{config.backend_url}/auth/o2/token",
                endpoint=config.backend_url,
            )
            self._offers_api = OffersApi(client.api_client)
            print("Offers API client initialized successfully.")
        return self._offers_api

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

    # -- Step 1: Get Offers (product-page delivery promise) --------------------

    def get_offers(self) -> Dict[str, Any]:
        """
        Call getOffers to retrieve per-item delivery options (estimated delivery date range + offer expiry).

        Key fields in the response:
        - offerResults[].item.productIdentifier.amazonSku
        - offerResults[].offers[].expiryTime
        - offerResults[].offers[].fulfillmentConfiguration.serviceLevel.serviceTier
        - offerResults[].offers[].fulfillmentConfiguration.serviceLevel.deliveryInterval
          (startTime / endTime)
        - offerResults[].constraints[] (e.g., item out of stock -> no offers)
        """
        print("[Step 1] Calling getOffers (product-page delivery promise)...")
        response = self.offers_api.get_offers(body=self._offers_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 1] Offers retrieved successfully.")
        return response

    # -- Step 2: Get Order Preview (checkout preview) ---------------------------

    def get_order_preview(self) -> Dict[str, Any]:
        """
        Call getOrderPreview to retrieve the order-level breakdown: how the order splits into planned shipments, estimated weight, delivery/ship intervals,
        and estimated fees.

        Key fields in the response:
        - plannedShipments[].estimatedShippingWeight
        - plannedShipments[].items[]
        - plannedShipments[].offers[].fulfillmentConfiguration.serviceLevel
          (serviceTier, deliveryInterval, shipInterval)
        - plannedShipments[].offers[].estimatedPrice.rollupPrices[] / totalPrice
        - constraints[] (anything preventing fulfillment)
        """
        print("[Step 2] Calling getOrderPreview (checkout review)...")
        response = self.previews_api.get_order_preview(body=self._preview_request)
        if hasattr(response, "to_dict"):
            response = response.to_dict() or {}
        print("[Step 2] Order preview retrieved successfully.")
        return response

    # -- Main entry point ------------------------------------------------------

    def start(self) -> None:
        """
        Run both preview calls in sequence, mirroring the shopper funnel: product page (offers) -> checkout review (order preview).
        """
        # Step 1 - Product-page delivery promise
        offers = self.get_offers()
        print("Offers (truncated):", str(offers)[:500])

        # Step 2 - Checkout-review shipment split + fees
        preview = self.get_order_preview()
        print("Order preview (truncated):", str(preview)[:500])

        print("\n\u2705 MCF product page & checkout previews workflow completed successfully.")


# -- Convenience for local / manual runs --------------------------------------
if __name__ == "__main__":
    recipe = McfProductPageAndCheckoutPreviewsRecipe()
    recipe.start()
