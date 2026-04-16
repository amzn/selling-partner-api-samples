package multichannel_fulfillment.fulfillment_outbound_v1;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF Create and Track Order Recipe.
 * Workflow: preview → create → get order → track package.
 */
public class McfCreateAndTrackOrderRecipeTest extends RecipeTest {

    protected McfCreateAndTrackOrderRecipeTest() {
        super(
                new McfCreateAndTrackOrderRecipe(),
                List.of(
                        "mcf-v1-getFulfillmentPreview",
                        "mcf-v1-createFulfillmentOrder",
                        "mcf-v1-getFulfillmentOrder",
                        "mcf-v1-getPackageTrackingDetails"
                )
        );
    }
}
