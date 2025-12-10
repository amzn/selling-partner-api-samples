package easyship;

import util.RecipeTest;

import java.util.List;

public class EasyShipOrderProcessingRecipeTest extends RecipeTest {

    protected EasyShipOrderProcessingRecipeTest() {
        super(
                new EasyShipOrderProcessingRecipe(),
                List.of(
                        "externalFulfillmentShipping-getShipments",
                        "externalFulfillmentShipping-processShipment",
                        "externalFulfillmentShipping-createPackages",
                        "externalFulfillmentShipping-retrieveShippingOptions",
                        "externalFulfillmentShipping-generateShipLabels"
                )
        );
    }
}
