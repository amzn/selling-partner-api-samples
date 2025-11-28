package easyship;

import util.RecipeTest;

import java.util.List;

public class RetrieveOrderRecipeTest extends RecipeTest {

    protected RetrieveOrderRecipeTest() {
        super(
                new RetrieveOrderRecipe(),
                List.of(
                    "orders-getOrder",
                    "orders-getOrderItems",
                    ""
                )
        );
    }
}
