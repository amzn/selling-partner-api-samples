package pricing;

import util.RecipeTest;

import java.util.List;

public class FetchPriceRecipeTest extends RecipeTest {

    protected FetchPriceRecipeTest() {
        super(
                new FetchPriceRecipe(),
                List.of("pricing-getPricing")
        );
    }
}
