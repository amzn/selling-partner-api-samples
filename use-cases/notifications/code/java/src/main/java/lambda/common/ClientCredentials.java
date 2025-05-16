package lambda.common;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ClientCredentials {
    @SerializedName("clientId")
    private String clientId;

    @SerializedName("clientSecret")
    private String clientSecret;

    @SerializedName("regionCode")
    private String regionCode;

    @SerializedName("sellerId")
    private String sellerId;

    @SerializedName("refreshToken")
    private String refreshToken;

    @SerializedName("marketplaceId")
    private String marketplaceId;

    @SerializedName("mail")
    private String mail;
}
