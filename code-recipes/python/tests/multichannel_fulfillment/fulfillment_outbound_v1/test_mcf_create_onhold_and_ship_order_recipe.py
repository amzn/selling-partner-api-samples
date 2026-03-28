"""
Tests for the MCF Create On-Hold and Ship Order Recipe.

Uses the RecipeTest helper to configure the mock backend with ordered
responses and then runs the recipe end to end.
"""

from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1.mcf_create_onhold_and_ship_order_recipe import McfCreateOnHoldAndShipOrderRecipe
from tests.recipe_test import RecipeTest


def test_mcf_create_onhold_and_ship_order():
    """
    Workflow: preview → create (Hold) → update (Ship) → get order → track package.
    Each response file corresponds to one API call in sequence.
    """
    recipe = McfCreateOnHoldAndShipOrderRecipe()
    test = RecipeTest(
        recipe=recipe,
        responses=[
            "getFulfillmentPreview_response.json",
            "createFulfillmentOrder_response.json",
            "updateFulfillmentOrder_response.json",
            "getFulfillmentOrder_response.json",
            "getPackageTrackingDetails_response.json",
        ],
    )
    test.test_recipe()
