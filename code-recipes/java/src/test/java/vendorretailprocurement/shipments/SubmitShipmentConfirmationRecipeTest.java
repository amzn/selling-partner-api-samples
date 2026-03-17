package vendorretailprocurement.shipments;

import util.RecipeTest;
import java.util.List;

/**
 * Test for SubmitShipmentConfirmationRecipe using mock backend.
 */
public class SubmitShipmentConfirmationRecipeTest extends RecipeTest {

    public SubmitShipmentConfirmationRecipeTest() {
        super(new SubmitShipmentConfirmationRecipe(), 
              List.of("vendorshipments-submitShipmentConfirmation"));
    }
}
