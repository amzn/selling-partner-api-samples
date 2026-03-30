"""
Tests for the MCF Create and Cancel Order Recipe.

Uses the RecipeTest helper to configure the mock backend with ordered
responses and then runs the recipe end to end.
"""

from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1.mcf_create_and_cancel_order_recipe import McfCreateAndCancelOrderRecipe
from tests.recipe_test import RecipeTest


def test_mcf_create_and_cancel_order():
    """
    Workflow: preview → create → cancel → verify cancellation.
    Each response file corresponds to one API call in sequence.
    """
    recipe = McfCreateAndCancelOrderRecipe()
    test = RecipeTest(
        recipe=recipe,
        responses=[
            "mcf-v1-getFulfillmentPreview.json",
            "mcf-v1-createFulfillmentOrder.json",
            "mcf-v1-cancelFulfillmentOrder.json",
            "mcf-v1-getFulfillmentOrder-cancelled.json",
        ],
    )
    test.test_recipe()
