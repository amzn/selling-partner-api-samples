package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2B.AOCN.B2BAnyOfferChangedNotification;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPayloadB2B {

    @JsonProperty("b2bAnyOfferChangedNotification")
    public B2BAnyOfferChangedNotification b2bAnyOfferChangedNotification;
}
