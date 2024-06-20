package lambda.utils.B2B;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.B2C.Amount;
import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FeedDetails {
    @JsonProperty("feedDocumentId")
    public String feedDocumentId;
    @JsonProperty("feedUrl")
    public String feedUrl;
    @JsonProperty("feedId")
    public String feedId;
    @JsonProperty("feedResponseDocId")
    public float feedResponseDocId;
    @JsonProperty("feedResponseDocUrk")
    public String feedResponseDocUrl;



}
