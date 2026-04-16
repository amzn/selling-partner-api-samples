package multichannel_fulfillment.fulfillment_outbound_v1;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF Create and Cancel Order Recipe.
 * Workflow: preview → create → cancel → verify cancellation.
 */
public class McfCreateAndCancelOrderRecipeTest extends RecipeTest {

    protected McfCreateAndCancelOrderRecipeTest() {
        super(
                new McfCreateAndCancelOrderRecipe(),
                List.of(
                        "mcf-v1-getFulfillmentPreview",
                        "mcf-v1-createFulfillmentOrder",
                        "mcf-v1-cancelFulfillmentOrder",
                        "mcf-v1-getFulfillmentOrder-cancelled"
                )
        );
    }
}
