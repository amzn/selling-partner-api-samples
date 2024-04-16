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
public class StateMachineInput {

    @JsonProperty("accountId")
    public String accountId;

    @JsonProperty("queryId")
    public String queryId;

    @JsonProperty("query")
    public String query;

    @JsonProperty("document")
    public Document document;

    @JsonProperty("processingStatus")
    public String processingStatus;
}
