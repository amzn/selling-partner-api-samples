from src.recipes.vendor_retail_procurement.transaction.get_transaction_recipe import (
    GetTransactionRecipe,
)
from tests.recipe_test import RecipeTest


class TestGetTransactionRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            GetTransactionRecipe(),
            ["vendortransaction-getTransaction"],
        )


def test_get_transaction() -> None:
    test = TestGetTransactionRecipe()
    test.test_recipe()
