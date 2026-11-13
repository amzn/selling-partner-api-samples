package vendorretailprocurement.shipments;

import util.RecipeTest;
import java.util.List;

public class GetShipmentDetailsRecipeTest extends RecipeTest {
    public GetShipmentDetailsRecipeTest() {
        super(new GetShipmentDetailsRecipe(), List.of("vendorshipments-getShipmentDetails"));
    }
}
