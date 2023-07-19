package lambda.utils;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RegionConfig {

    public String awsRegion;

    public String spApiEndpoint;
}
