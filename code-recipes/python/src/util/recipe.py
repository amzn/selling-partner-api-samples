"""
Base Recipe class for Python SP-API recipes.
"""

from abc import ABC, abstractmethod
from typing import Optional

from spapi import SPAPIConfig


class Recipe(ABC):
    """
    Abstract base class that aligns Python recipes with the structure used in
    the Java/PHP samples. Each recipe must provide a start() entry point and
    can optionally supply its own SP-API configuration.
    """

    def __init__(self, config: Optional[SPAPIConfig] = None) -> None:
        self.config = config or SPAPIConfig(
            client_id="YOUR_LWA_CLIENT_ID",
            client_secret="YOUR_LWA_CLIENT_SECRET",
            refresh_token="YOUR_LWA_REFRESH_TOKEN",
            region="NA",
        )

    @abstractmethod
    def start(self) -> None:
        """
        Main entry point for the recipe. Implementations should orchestrate the
        end-to-end flow for the corresponding use case.
        """
        raise NotImplementedError
