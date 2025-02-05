package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ApiCredentials {

    @JsonProperty("refreshToken")
    public String refreshToken;

    @JsonProperty("regionCode")
    public String regionCode;

}
