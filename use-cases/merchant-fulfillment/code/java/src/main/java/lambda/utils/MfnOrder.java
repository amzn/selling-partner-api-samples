package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import io.swagger.client.model.mfn.Address;
import io.swagger.client.model.mfn.PackageDimensions;
import io.swagger.client.model.mfn.ShippingService;
import io.swagger.client.model.mfn.ShippingServiceList;
import io.swagger.client.model.mfn.Weight;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class MfnOrder {

    @JsonProperty("orderItems")
    public List<MfnOrderItem> orderItems;

    @JsonProperty("shipFromAddress")
    public Address shipFromAddress;

    @JsonProperty("packageDimensions")
    public PackageDimensions packageDimensions;

    @JsonProperty("weight")
    public Weight weight;

    @JsonProperty("shippingServiceList")
    public ShippingServiceList shippingServiceList;

    @JsonProperty("preferredShippingService")
    public ShippingService preferredShippingService;
}
