package multichannel_fulfillment.fulfillment_outbound_v1;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF Create On-Hold and Ship Order Recipe.
 * Workflow: preview → create (Hold) → update (Ship) → get order → track package.
 */
public class McfCreateOnHoldAndShipOrderRecipeTest extends RecipeTest {

    protected McfCreateOnHoldAndShipOrderRecipeTest() {
        super(
                new McfCreateOnHoldAndShipOrderRecipe(),
                List.of(
                        "mcf-v1-getFulfillmentPreview",
                        "mcf-v1-createFulfillmentOrder",
                        "mcf-v1-updateFulfillmentOrder",
                        "mcf-v1-getFulfillmentOrder",
                        "mcf-v1-getPackageTrackingDetails"
                )
        );
    }
}
