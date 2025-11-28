"""
Base test helper that mirrors the Java RecipeTest implementation.
"""

import json
import urllib.request
from typing import List

from src.recipes.datakiosk import constants


class RecipeTest:
    """
    Helper that configures the mock backend with a list of responses and then
    executes the recipe. Individual tests only need to provide the recipe
    instance and the ordered list of response file names.
    """

    def __init__(self, recipe, responses: List[str]) -> None:
        self.recipe = recipe
        self.responses = responses
        self.backend_url = constants.backend_url

    def test_recipe(self) -> None:
        self._instruct_backend_mock()
        self.recipe.start()

    def _instruct_backend_mock(self) -> None:
        payload = json.dumps(self.responses).encode("utf-8")
        request = urllib.request.Request(
            url=f"{self.backend_url}/responses",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request) as response:
            # Drain the response to make sure the request completes
            response.read()
