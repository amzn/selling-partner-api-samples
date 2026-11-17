package pricing;

import util.RecipeTest;

import java.util.List;

public class SubmitPriceRecipeTest extends RecipeTest {

    protected SubmitPriceRecipeTest() {
        super(
                new SubmitPriceRecipe(),
                List.of("pricing-getListingsItem", "pricing-patchListingsItem")
        );
    }
}
