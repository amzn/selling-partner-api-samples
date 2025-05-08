package lambda.utils;


import com.google.gson.annotations.SerializedName;
import lombok.*;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ApiCredentials {

    @SerializedName("refreshToken")
    public String refreshToken;

    @SerializedName("regionCode")
    public String regionCode;

}
