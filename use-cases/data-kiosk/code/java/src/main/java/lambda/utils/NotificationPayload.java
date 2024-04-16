package lambda.utils;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationPayload {

    @JsonProperty("accountId")
    public String accountId;

    @JsonProperty("queryId")
    public String queryId;

    @JsonProperty("query")
    public String query;

    @JsonProperty("processingStatus")
    public String processingStatus;

    @JsonProperty("dataDocumentId")
    public String dataDocumentId;

    @JsonProperty("errorDocumentId")
    public String errorDocumentId;
}
