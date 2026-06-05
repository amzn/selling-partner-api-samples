from src.recipes.vendor_retail_procurement.shipments.get_shipment_labels_recipe import (
    GetShipmentLabelsRecipe,
)
from tests.recipe_test import RecipeTest


class TestGetShipmentLabelsRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetShipmentLabelsRecipe(),
            ["vendorshipments-getShipmentLabels"],
        )


def test_get_shipment_labels() -> None:
    test = TestGetShipmentLabelsRecipe()
    test.test_recipe()
