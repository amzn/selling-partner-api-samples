import importlib

DataKioskQueryRecipe = importlib.import_module(
    "src.recipes.2-reporting-analytics.data-kiosk.datakiosk_query_recipe"
).DataKioskQueryRecipe
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
