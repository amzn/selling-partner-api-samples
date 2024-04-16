package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.QueriesApi;
import io.swagger.client.model.datakiosk.GetDocumentResponse;
import lambda.utils.ApiUtils;
import lambda.utils.Document;
import lambda.utils.StateMachineInput;

import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;

public class GetDocumentHandler implements RequestHandler<StateMachineInput, Document> {

    public Document handleRequest(StateMachineInput input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("GetDocument Lambda input: " + new Gson().toJson(input));

        // Retrieve request details from the input payload
        String regionCode = System.getenv(REGION_CODE_ARN_ENV_VARIABLE);
        String refreshToken = System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE);

        try {
            // Initialize the DataKiosk API client
            QueriesApi dataKioskApi = ApiUtils.getDataKioskApi(regionCode, refreshToken);

            // Call the getDocument method to get document information for the specified query
            GetDocumentResponse response = dataKioskApi.getDocument(input.getDocument().getDocumentId());
            logger.log("Data Kiosk API Response: " + new Gson().toJson(response));

            if (response  != null) {
                return Document.builder()
                        .documentId(response.getDocumentId())
                        .documentUrl(response.getDocumentUrl())
                        .build();
            } else {
                // If the response is null, there is no data available for the given time range
                return Document.builder()
                        .issues("DOCUMENT IS EMPTY, NO DATA IS AVAILABLE FOR THE GIVEN TIME RANGE")
                        .build();
            }
        } catch (Exception e) {
            throw new InternalError("Get document failed", e);
        }
    }
}