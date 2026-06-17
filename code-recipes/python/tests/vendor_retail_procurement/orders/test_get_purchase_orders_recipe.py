from src.recipes.vendor_retail_procurement.orders.get_purchase_orders_recipe import (
    GetPurchaseOrdersRecipe,
)
from tests.recipe_test import RecipeTest


class TestGetPurchaseOrdersRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetPurchaseOrdersRecipe(),
            [
                "vendororders-getPurchaseOrders",
                "vendororders-getPurchaseOrders",
            ],
        )


def test_get_purchase_orders() -> None:
    test = TestGetPurchaseOrdersRecipe()
    test.test_recipe()
