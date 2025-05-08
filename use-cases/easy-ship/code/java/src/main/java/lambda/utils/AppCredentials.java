package lambda.utils;

import com.google.gson.annotations.SerializedName;
import lombok.Data;

@Data
public class AppCredentials {

    @SerializedName("AppClientId")
    public String clientId;

    @SerializedName("AppClientSecret")
    public String clientSecret;
}
