package easyship;

import util.RecipeTest;

import java.util.List;

public class EasyShipOrderProcessingRecipeTest extends RecipeTest {

    protected EasyShipOrderProcessingRecipeTest() {
        super(
                new EasyShipOrderProcessingRecipe(),
                List.of(
                        "externalFulfillmentShipments-getShipments",
                        "externalFulfillmentShipments-processShipment",
                        "externalFulfillmentShipments-createPackages",
                        "externalFulfillmentShipments-retrieveShippingOptions",
                        "externalFulfillmentShipments-generateShipLabels"
                )
        );
    }
}
