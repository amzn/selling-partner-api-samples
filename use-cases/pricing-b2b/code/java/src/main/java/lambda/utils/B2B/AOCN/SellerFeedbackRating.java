
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "feedbackCount",
    "sellerPositiveFeedbackRating"
})
@Data
public class SellerFeedbackRating {

    @JsonProperty("feedbackCount")
    public Long feedbackCount;
    @JsonProperty("sellerPositiveFeedbackRating")
    public Long sellerPositiveFeedbackRating;

}
