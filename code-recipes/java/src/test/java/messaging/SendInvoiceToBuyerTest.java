package messaging;

import util.RecipeTest;

import java.util.List;

public class SendInvoiceToBuyerTest extends RecipeTest {

    protected SendInvoiceToBuyerTest() {
        super(
                new SendInvoiceToBuyerRecipe(),
                List.of(
                    "messaging-getMessagingActionsForOrder",
                    "messaging-createUploadDestination",
                    ""
                )
        );
    }
}