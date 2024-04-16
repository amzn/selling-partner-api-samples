package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.QueriesApi;
import lambda.utils.ApiUtils;

import java.util.Map;

import static lambda.utils.Constants.QUERY_ID_KEY_NAME;
import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;

public class CancelQueryHandler implements RequestHandler<Map<String, String>, String> {

    // Sample event input:
    // {
    //  "QueryId": "1231413413531"
    // }

    public String handleRequest(Map<String, String> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CancelQuery Lambda input: " + new Gson().toJson(input));

        // Retrieve request details from the input payload
        String queryId = input.get(QUERY_ID_KEY_NAME);
        String regionCode = System.getenv(REGION_CODE_ARN_ENV_VARIABLE);
        String refreshToken = System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE);

        try {
            // Initialize the DataKiosk API client
            QueriesApi dataKioskApi = ApiUtils.getDataKioskApi(regionCode, refreshToken);

            // Call the cancelQuery method to create the query
            dataKioskApi.cancelQuery(queryId);

            return String.format("Query %s has been canceled successfully", queryId);
        } catch (Exception e) {
            throw new InternalError("Cancel query failed", e);
        }
    }
}