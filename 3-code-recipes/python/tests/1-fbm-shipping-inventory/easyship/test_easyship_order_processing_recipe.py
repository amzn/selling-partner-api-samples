import importlib

EasyShipOrderProcessingRecipe = importlib.import_module(
    "src.recipes.1-fbm-shipping-inventory.easyship.easyship_order_processing_recipe"
).EasyShipOrderProcessingRecipe
from tests.recipe_test import RecipeTest


class TestEasyShipOrderProcessingRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            EasyShipOrderProcessingRecipe(),
            [
                "externalFulfillmentShipping-getShipments",
                "externalFulfillmentShipping-processShipment",
                "externalFulfillmentShipping-createPackages",
                "externalFulfillmentShipping-retrieveShippingOptions",
                "externalFulfillmentShipping-generateShipLabels",
            ],
        )


def test_easyship_order_processing_recipe() -> None:
    test = TestEasyShipOrderProcessingRecipe()
    test.test_recipe()
