package easyship;

import util.RecipeTest;

import java.util.List;

public class CalculateOrderDimensionsRecipeTest extends RecipeTest {

    protected CalculateOrderDimensionsRecipeTest() {
        super(
                new CalculateOrderDimensionsRecipe(),
                List.of(
                    "orders-getOrderItems",
                    "catalogitems-getCatalogItem",
                    "listings-getListingsItem"
                )
        );
    }
}
