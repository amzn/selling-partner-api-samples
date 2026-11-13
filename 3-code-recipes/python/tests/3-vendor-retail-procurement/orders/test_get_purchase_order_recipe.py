import importlib

GetPurchaseOrderRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.orders.get_purchase_order_recipe"
).GetPurchaseOrderRecipe
from tests.recipe_test import RecipeTest


class TestGetPurchaseOrderRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetPurchaseOrderRecipe(),
            ["vendororders-getPurchaseOrder"],
        )


def test_get_purchase_order() -> None:
    test = TestGetPurchaseOrderRecipe()
    test.test_recipe()
