
package lambda.utils.B2B.AOCN;

import lombok.Data;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonPropertyOrder({
    "country"
})
@Data
public class ShipsFrom {

    @JsonProperty("country")
    public String country;

}
