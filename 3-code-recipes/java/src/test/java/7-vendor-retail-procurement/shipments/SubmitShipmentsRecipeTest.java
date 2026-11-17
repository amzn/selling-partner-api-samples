package vendorretailprocurement.shipments;

import util.RecipeTest;

import java.util.List;

public class SubmitShipmentsRecipeTest extends RecipeTest {

    public SubmitShipmentsRecipeTest() {
        super(new SubmitShipmentsRecipe(), List.of("vendorshipments-submitShipments"));
    }
}
