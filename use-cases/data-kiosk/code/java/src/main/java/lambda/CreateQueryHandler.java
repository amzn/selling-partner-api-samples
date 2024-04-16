package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import io.swagger.client.api.QueriesApi;
import io.swagger.client.model.datakiosk.CreateQueryResponse;
import io.swagger.client.model.datakiosk.CreateQuerySpecification;
import lambda.utils.ApiUtils;

import java.util.Map;

import static lambda.utils.Constants.QUERY_CODE_KEY_NAME;
import static lambda.utils.Constants.REFRESH_TOKEN_ARN_ENV_VARIABLE;
import static lambda.utils.Constants.REGION_CODE_ARN_ENV_VARIABLE;

public class CreateQueryHandler implements RequestHandler<Map<String, String>, CreateQueryResponse> {

    // Sample event input:
    // {
    //  "Query": "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin...",
    // }

    public CreateQueryResponse handleRequest(Map<String, String> input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("CreateQuery Lambda input: " + new Gson().toJson(input));

        // Retrieve request details from the input payload
        String queryCode = input.get(QUERY_CODE_KEY_NAME);
        String regionCode = System.getenv(REGION_CODE_ARN_ENV_VARIABLE);
        String refreshToken = System.getenv(REFRESH_TOKEN_ARN_ENV_VARIABLE);

        try {
            // Initialize the DataKiosk API client
            QueriesApi dataKioskApi = ApiUtils.getDataKioskApi(regionCode, refreshToken);

            // Build the createQuery request using the query from the input payload
            CreateQuerySpecification request = new CreateQuerySpecification();
            request.setQuery(queryCode);

            // Call the createQuery method to cancel the query
            CreateQueryResponse response = dataKioskApi.createQuery(request);
            logger.log(String.format("CreateQuery API response: %s", new Gson().toJson(response)));

            return response;
        } catch (Exception e) {
            throw new InternalError("Create query failed", e);
        }
    }

}
