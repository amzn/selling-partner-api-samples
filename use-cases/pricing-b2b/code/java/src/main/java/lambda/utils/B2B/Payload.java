
package lambda.utils.B2B;

import lambda.utils.B2B.AOCN.B2BAnyOfferChangedNotification;
import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "b2bAnyOfferChangedNotification"
})
@Data
public class Payload {

    @JsonProperty("b2bAnyOfferChangedNotification")
    public B2BAnyOfferChangedNotification b2bAnyOfferChangedNotification;

}
