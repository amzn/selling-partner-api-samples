from src.recipes.datakiosk.datakiosk_query_recipe import DataKioskQueryRecipe
from tests.recipe_test import RecipeTest


class TestDataKioskQueryRecipe(RecipeTest):
    def __init__(self) -> None:
        super().__init__(
            DataKioskQueryRecipe(),
            [
                "datakiosk-createQuery",
                "datakiosk-getDocument",
                "datakiosk-document",
            ],
        )


def test_datakiosk_recipe() -> None:
    test = TestDataKioskQueryRecipe()
    test.test_recipe()
