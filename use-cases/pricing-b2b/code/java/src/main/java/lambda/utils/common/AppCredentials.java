package lambda.utils.common;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AppCredentials {

    @JsonProperty("AppClientId")
    public String clientId;

    @JsonProperty("AppClientSecret")
    public String clientSecret;
}
