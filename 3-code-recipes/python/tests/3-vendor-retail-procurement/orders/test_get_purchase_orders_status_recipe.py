import importlib

GetPurchaseOrdersStatusRecipe = importlib.import_module(
    "src.recipes.3-vendor-retail-procurement.orders.get_purchase_orders_status_recipe"
).GetPurchaseOrdersStatusRecipe
from tests.recipe_test import RecipeTest


class TestGetPurchaseOrdersStatusRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetPurchaseOrdersStatusRecipe(),
            [
                "vendororders-getPurchaseOrdersStatus",
                "vendororders-getPurchaseOrdersStatus",
            ],
        )


def test_get_purchase_orders_status() -> None:
    test = TestGetPurchaseOrdersStatusRecipe()
    test.test_recipe()
