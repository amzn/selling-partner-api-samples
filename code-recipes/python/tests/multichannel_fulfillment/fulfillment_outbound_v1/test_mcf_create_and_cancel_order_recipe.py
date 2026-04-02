from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1.mcf_create_and_cancel_order_recipe import (
    McfCreateAndCancelOrderRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfCreateAndCancelOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateAndCancelOrderRecipe(),
            [
                "mcf-v1-getFulfillmentPreview",
                "mcf-v1-createFulfillmentOrder",
                "mcf-v1-cancelFulfillmentOrder",
                "mcf-v1-getFulfillmentOrder-cancelled",
            ],
        )


def test_mcf_create_and_cancel_order() -> None:
    test = TestMcfCreateAndCancelOrderRecipe()
    test.test_recipe()
