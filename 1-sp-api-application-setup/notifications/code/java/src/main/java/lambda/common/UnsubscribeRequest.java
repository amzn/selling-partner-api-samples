package lambda.common;

import com.google.gson.annotations.SerializedName;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Getter
@Setter
public class UnsubscribeRequest {

    @SerializedName("DeleteAll")
    private Boolean DeleteAll;

    @SerializedName("DeleteDestination")
    private Boolean DeleteDestination;

    @SerializedName("NotificationTypes")
    private List<String> NotificationTypes;

    @SerializedName("SellerIds")
    private List<String> SellerIds;

    public void initDefaults() {
        if (DeleteAll == null) {
            DeleteAll = false;
        }
        if (DeleteDestination == null) {
            DeleteDestination = false;
        }
        if (NotificationTypes == null) {
            NotificationTypes = List.of();
        }
        if (SellerIds == null) {
            SellerIds = List.of();
        }
    }
}
