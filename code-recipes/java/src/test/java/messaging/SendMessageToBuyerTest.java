package messaging;

import util.RecipeTest;

import java.util.List;

public class SendMessageToBuyerTest extends RecipeTest {

    protected SendMessageToBuyerTest() {
        super(
                new SendInvoiceToBuyer(),
                List.of(
                        "{\"_links\":{\"actions\":[{\"href\":\"/messaging/v1/orders/123-4567890-1234567/messages/confirmCustomizationDetails\",\"name\":\"confirmCustomizationDetails\"}]},\"_embedded\":{\"actions\":[{\"title\":\"Confirm customization details\",\"schema\":{\"type\":\"object\",\"properties\":{\"text\":{\"type\":\"string\",\"minLength\":1,\"maxLength\":2000}}}}]}}",
                        "{\"errors\":[]}"
                )
        );
    }
}