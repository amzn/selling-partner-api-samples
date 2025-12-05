from src.recipes.easyship.easyship_order_processing_recipe import (
    EasyShipOrderProcessingRecipe,
)
from tests.recipe_test import RecipeTest


class TestEasyShipOrderProcessingRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            EasyShipOrderProcessingRecipe(),
            [
                "externalFulfillmentShipments-getShipments",
                "externalFulfillmentShipments-processShipment",
                "externalFulfillmentShipments-createPackages",
                "externalFulfillmentShipments-retrieveShippingOptions",
                "externalFulfillmentShipments-generateShipLabels",
            ],
        )


def test_easyship_order_processing_recipe() -> None:
    test = TestEasyShipOrderProcessingRecipe()
    test.test_recipe()
