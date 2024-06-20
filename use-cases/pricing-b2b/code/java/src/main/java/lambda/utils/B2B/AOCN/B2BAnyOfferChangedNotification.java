
package lambda.utils.B2B.AOCN;

import java.util.List;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Data;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
        "sellerId",
        "offerChangeTrigger",
        "summary",
        "offers"
})
@Data
public class B2BAnyOfferChangedNotification {

    @JsonProperty("sellerId")
    public String sellerId;
    @JsonProperty("offerChangeTrigger")
    public OfferChangeTriggerB2B offerChangeTrigger;
    @JsonProperty("summary")
    public Summary summary;
    @JsonProperty("offers")
    public List<B2BOffer> offers;

}
