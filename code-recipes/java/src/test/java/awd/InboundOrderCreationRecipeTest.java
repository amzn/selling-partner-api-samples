package awd;

import util.RecipeTest;

import java.util.List;

public class InboundOrderCreationRecipeTest extends RecipeTest {

    protected InboundOrderCreationRecipeTest() {
        super(
                new InboundOrderCreationRecipe(),
                List.of(
                        "awd-checkInboundEligibility",
                        "awd-createInbound",
                        "awd-getInbound",
                        ""
                )
        );
    }
}
