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
            "mcf-v1-getFulfillmentPreview.json",
            "mcf-v1-createFulfillmentOrder.json",
            "mcf-v1-updateFulfillmentOrder.json",
            "mcf-v1-getFulfillmentOrder.json",
            "mcf-v1-getPackageTrackingDetails.json",
        ],
    )
    test.test_recipe()
