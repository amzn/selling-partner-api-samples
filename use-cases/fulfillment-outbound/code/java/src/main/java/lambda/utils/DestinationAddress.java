package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class DestinationAddress {

    @JsonProperty("name")
    public String name;

    @JsonProperty("addressLine1")
    public String addressLine1;

    @JsonProperty("addressLine2")
    public String addressLine2;

    @JsonProperty("addressLine3")
    public String addressLine3;

    @JsonProperty("districtOrCounty")
    public String districtOrCounty;

    @JsonProperty("city")
    public String city;

    @JsonProperty("stateOrRegion")
    public String stateOrRegion;

    @JsonProperty("postalCode")
    public String postalCode;

    @JsonProperty("countryCode")
    public String countryCode;

    @JsonProperty("phone")
    public String phone;
}
