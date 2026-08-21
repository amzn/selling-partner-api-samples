package multichannel_fulfillment.fulfillment_outbound_v2;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF (v2026-07-04) Product Page and Checkout Previews Recipe.
 * Workflow: getOffers (product page) -> getOrderPreview (checkout review).
 */
public class McfProductPageAndCheckoutPreviewsRecipeTest extends RecipeTest {

    protected McfProductPageAndCheckoutPreviewsRecipeTest() {
        super(
                new McfProductPageAndCheckoutPreviewsRecipe(),
                List.of(
                        "mcf-v2-getOffers",
                        "mcf-v2-getOrderPreview"
                )
        );
    }
}
