from src.recipes.multichannel_fulfillment.fulfillment_outbound_v1.mcf_create_onhold_and_ship_order_recipe import (
    McfCreateOnHoldAndShipOrderRecipe,
)
from tests.recipe_test import RecipeTest


class TestMcfCreateOnHoldAndShipOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateOnHoldAndShipOrderRecipe(),
            [
                "mcf-v1-getFulfillmentPreview",
                "mcf-v1-createFulfillmentOrder",
                "mcf-v1-updateFulfillmentOrder",
                "mcf-v1-getFulfillmentOrder",
                "mcf-v1-getPackageTrackingDetails",
            ],
        )


def test_mcf_create_onhold_and_ship_order() -> None:
    test = TestMcfCreateOnHoldAndShipOrderRecipe()
    test.test_recipe()
