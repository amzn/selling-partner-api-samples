"""
Tests for the MCF Create and Track Order Recipe.

Uses the RecipeTest helper to configure the mock backend with ordered
responses and then runs the recipe end to end.
"""

from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1.mcf_create_and_track_order_recipe import McfCreateAndTrackOrderRecipe
from tests.recipe_test import RecipeTest


def test_mcf_create_and_track_order():
    """
    Workflow: preview → create → get order → track package.
    Each response file corresponds to one API call in sequence.
    """
    recipe = McfCreateAndTrackOrderRecipe()
    test = RecipeTest(
        recipe=recipe,
        responses=[
            "getFulfillmentPreview_response.json",
            "createFulfillmentOrder_response.json",
            "getFulfillmentOrder_response.json",
            "getPackageTrackingDetails_response.json",
        ],
    )
    test.test_recipe()
