package vendorretailprocurement.shipments;

import util.RecipeTest;
import java.util.List;

public class GetShipmentLabelsRecipeTest extends RecipeTest {
    public GetShipmentLabelsRecipeTest() {
        super(new GetShipmentLabelsRecipe(), List.of("vendorshipments-getShipmentLabels"));
    }
}
