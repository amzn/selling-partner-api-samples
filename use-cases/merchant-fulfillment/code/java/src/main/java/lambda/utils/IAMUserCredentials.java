package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
public class IAMUserCredentials {

    @JsonProperty("AccessKeyId")
    public String accessKeyId;

    @JsonProperty("SecretKey")
    public String secretKey;
}
