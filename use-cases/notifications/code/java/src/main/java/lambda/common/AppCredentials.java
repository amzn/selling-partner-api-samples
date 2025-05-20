package lambda.common;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;

@Getter
public class AppCredentials {

    @SerializedName("AppClientId")
    private String clientId;

    @SerializedName("AppClientSecret")
    private String clientSecret;

    public AppCredentials(String clientId, String clientSecret) {
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
}

