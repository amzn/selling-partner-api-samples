from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2.mcf_create_onhold_and_ship_order_recipe import (
    McfCreateOnHoldAndShipOrderRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfCreateOnHoldAndShipOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateOnHoldAndShipOrderRecipe(),
            [
                "mcf-v2-getOrderPreview",
                "mcf-v2-createOrder",
                "mcf-v2-updateOrder",
                "mcf-v2-getOrder",
            ],
        )


def test_mcf_create_onhold_and_ship_order() -> None:
    test = TestMcfCreateOnHoldAndShipOrderRecipe()
    test.test_recipe()
