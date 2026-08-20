from src.recipes.multichannel_fulfillment.fulfillment_outbound_v2.mcf_create_and_track_order_recipe import (
    McfCreateAndTrackOrderRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfCreateAndTrackOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateAndTrackOrderRecipe(),
            [
                "mcf-v2-getOrderPreview",
                "mcf-v2-createOrder",
                "mcf-v2-listOrders",
                "mcf-v2-getOrder",
            ],
        )


def test_mcf_create_and_track_order() -> None:
    test = TestMcfCreateAndTrackOrderRecipe()
    test.test_recipe()
