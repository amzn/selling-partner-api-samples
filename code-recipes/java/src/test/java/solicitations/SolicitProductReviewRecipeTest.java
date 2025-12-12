package solicitations;

import util.RecipeTest;

import java.util.List;

public class SolicitProductReviewRecipeTest extends RecipeTest {

    protected SolicitProductReviewRecipeTest() {
        super(
                new SolicitProductReviewRecipe(),
                List.of(
                    "solicitations-orders-getOrder",
                    "solicitations-getSolicitationActionsForOrder",
                    "solicitations-createProductReviewAndSellerFeedbackSolicitation"
                )
        );
    }
}
