package lambda.utils.common;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    @JsonProperty("marketplaceId")
    public String marketplaceId;
}
