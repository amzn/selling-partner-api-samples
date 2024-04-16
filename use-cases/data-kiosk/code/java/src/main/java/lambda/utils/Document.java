package lambda.utils;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Builder
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Document {

    @JsonProperty("documentId")
    public String documentId;

    @JsonProperty("documentUrl")
    public String documentUrl;

    @JsonProperty("issues")
    public String issues;

    @JsonProperty("s3Uri")
    public String s3Uri;
}
