package multichannel_fulfillment.fulfillment_outbound_v2;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF (v2026-07-04) Create and Track Order Recipe.
 * Workflow: getOrderPreview -> createOrder -> listOrders -> getOrder (embedded tracking).
 */
public class McfCreateAndTrackOrderRecipeTest extends RecipeTest {

    protected McfCreateAndTrackOrderRecipeTest() {
        super(
                new McfCreateAndTrackOrderRecipe(),
                List.of(
                        "mcf-v2-getOrderPreview",
                        "mcf-v2-createOrder",
                        "mcf-v2-listOrders",
                        "mcf-v2-getOrder"
                )
        );
    }
}
