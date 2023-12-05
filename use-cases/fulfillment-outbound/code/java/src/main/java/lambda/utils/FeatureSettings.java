package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class FeatureSettings {

    @JsonProperty("featureName")
    public String featureName;

    @JsonProperty("featureFulfillmentPolicy")
    public String featureFulfillmentPolicy;
}