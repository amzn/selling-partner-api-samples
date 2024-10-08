package lambda.utils;

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

    @JsonProperty("marketplaceId")
    public String marketplaceId;
}
