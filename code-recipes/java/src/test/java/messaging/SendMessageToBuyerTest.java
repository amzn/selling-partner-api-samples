package messaging;

import util.RecipeTest;

import java.util.List;

public class SendMessageToBuyerTest extends RecipeTest {

    protected SendMessageToBuyerTest() {
        super(
                new SendInvoiceToBuyer(),
                List.of(
                    "",
                    "",
                    "messaging-getMessagingActionsForOrder",
                    "",
                    "",
                    "messaging-createUploadDestination",
                    "",
                    ""
                )
        );
    }
}