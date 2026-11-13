package multichannel_fulfillment.fulfillment_outbound_v2;

import util.RecipeTest;

import java.util.List;

/**
 * Test for the MCF (v2026-07-04) Create On-Hold and Ship Order Recipe.
 * Workflow: getOrderPreview -> createOrder (HOLD) -> updateOrder (SHIP) -> getOrder.
 */
public class McfCreateOnHoldAndShipOrderRecipeTest extends RecipeTest {

    protected McfCreateOnHoldAndShipOrderRecipeTest() {
        super(
                new McfCreateOnHoldAndShipOrderRecipe(),
                List.of(
                        "mcf-v2-getOrderPreview",
                        "mcf-v2-createOrder",
                        "mcf-v2-updateOrder",
                        "mcf-v2-getOrder"
                )
        );
    }
}
