package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class AppCredentials {

    @JsonProperty("AppClientId")
    public String clientId;

    @JsonProperty("AppClientSecret")
    public String clientSecret;
}
