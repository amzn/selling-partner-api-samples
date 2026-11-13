import importlib

SubmitShipmentsRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.shipments.submit_shipments_recipe"
).SubmitShipmentsRecipe
from tests.recipe_test import RecipeTest


class TestSubmitShipmentsRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            SubmitShipmentsRecipe(),
            ["vendorshipments-submitShipments"],
        )


def test_submit_shipments() -> None:
    test = TestSubmitShipmentsRecipe()
    test.test_recipe()
