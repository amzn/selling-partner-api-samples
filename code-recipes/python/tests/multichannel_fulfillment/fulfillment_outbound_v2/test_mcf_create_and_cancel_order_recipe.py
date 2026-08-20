from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2.mcf_create_and_cancel_order_recipe import (
    McfCreateAndCancelOrderRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfCreateAndCancelOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateAndCancelOrderRecipe(),
            [
                "mcf-v2-getOrderPreview",
                "mcf-v2-createOrder",
                "mcf-v2-cancelOrder",
            ],
        )


def test_mcf_create_and_cancel_order() -> None:
    test = TestMcfCreateAndCancelOrderRecipe()
    test.test_recipe()
