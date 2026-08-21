package multichannel_fulfillment.fulfillment_outbound_v2;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF (v2026-07-04) Create and Cancel Order Recipe.
 * Workflow: getOrderPreview -> createOrder -> cancelOrder.
 */
public class McfCreateAndCancelOrderRecipeTest extends RecipeTest {

    protected McfCreateAndCancelOrderRecipeTest() {
        super(
                new McfCreateAndCancelOrderRecipe(),
                List.of(
                        "mcf-v2-getOrderPreview",
                        "mcf-v2-createOrder",
                        "mcf-v2-cancelOrder"
                )
        );
    }
}
