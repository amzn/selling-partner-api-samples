package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lambda.utils.interfaces.ApiCredentialsProvider;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class OperationStatusInput implements ApiCredentialsProvider {

    @JsonProperty("apiCredentials")
    public ApiCredentials apiCredentials;

    @JsonProperty("operationId")
    public String operationId;

    @Override
    public ApiCredentials getApiCredentials() {
        return apiCredentials;
    }
}
