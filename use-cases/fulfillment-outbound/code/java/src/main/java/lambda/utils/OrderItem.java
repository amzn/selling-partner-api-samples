package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrderItem {

    @JsonProperty("sellerSku")
    public String sellerSku;

    @JsonProperty("sellerFulfillmentOrderItemId")
    public String sellerFulfillmentOrderItemId;

    @JsonProperty("quantity")
    public Integer quantity;

    @JsonProperty("giftMessage")
    public String giftMessage;

    @JsonProperty("displayableComment")
    public String displayableComment;

    @JsonProperty("fulfillmentNetworkSku")
    public String fulfillmentNetworkSku;

    @JsonProperty("perUnitDeclaredValue")
    public Money perUnitDeclaredValue;

    @JsonProperty("perUnitPrice")
    public Money perUnitPrice;

    @JsonProperty("perUnitTax")
    public Money perUnitTax;    
}
