import importlib

McfCreateAndTrackOrderRecipe = importlib.import_module(
    "src.recipes.4-other.multichannel-fulfillment.fulfillment_outbound_v1.mcf_create_and_track_order_recipe"
).McfCreateAndTrackOrderRecipe
from tests.recipe_test import RecipeTest


class TestMcfCreateAndTrackOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            McfCreateAndTrackOrderRecipe(),
            [
                "mcf-v1-getFulfillmentPreview",
                "mcf-v1-createFulfillmentOrder",
                "mcf-v1-getFulfillmentOrder",
                "mcf-v1-getPackageTrackingDetails",
            ],
        )


def test_mcf_create_and_track_order() -> None:
    test = TestMcfCreateAndTrackOrderRecipe()
    test.test_recipe()
