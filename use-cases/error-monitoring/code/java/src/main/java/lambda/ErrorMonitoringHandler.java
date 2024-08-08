package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import io.swagger.client.ApiException;
import io.swagger.client.ApiResponse;
import io.swagger.client.api.CatalogApi;
import io.swagger.client.api.ReportsApi;
import io.swagger.client.api.SellersApi;
import io.swagger.client.model.CatalogApi.Item;
import io.swagger.client.model.CatalogApi.ItemSearchResults;
import io.swagger.client.model.ReportsApi.CreateReportResponse;
import io.swagger.client.model.ReportsApi.CreateReportSpecification;
import io.swagger.client.model.SellersApi.GetMarketplaceParticipationsResponse;
import org.threeten.bp.OffsetDateTime;

import java.util.List;
import java.util.Map;

import static java.util.Collections.singletonList;
import static lambda.utils.ApiUtils.*;
import static lambda.utils.Constants.*;

public class ErrorMonitoringHandler implements RequestHandler<Map<String, String>, String> {

    // Make sure to use the region code that matches your account
    private final String regionCode = NA_REGION_CODE;
    // Make sure to use the marketplace id that matches your account
    private final String marketplaceId = US_MARKETPLACE_ID;
    private final String refreshToken = System.getenv(REFRESH_TOKEN);

    public String handleRequest(Map<String, String> input, Context context) {
        context.getLogger().log("Input: " + input);

        triggerSuccessResponse(context);

        //Test different 4xx errors
        triggerBadRequestResponse(context);
        triggerNotFoundResponse(context);
        triggerTooManyRequestsResponse(context);

        return "Success!";
    }

    private void triggerBadRequestResponse(Context context) {
        try {
            CatalogApi catalogApi = catalogItemsApi(regionCode, refreshToken);

            String identifiersType = "ASINS";
            List<String> identifiers = singletonList(TEST_IDENTIFIER);
            List<String> marketplaceIds = singletonList(marketplaceId);

            ApiResponse<ItemSearchResults> httpResult = catalogApi.searchCatalogItemsWithHttpInfo(marketplaceIds, identifiers, identifiersType, null, null, null, null, null, null, null, null, null);
            logSuccessResponse(context, httpResult);

        } catch (ApiException e) {
            logApiException(context, e);
        } catch (Exception e) {
            context.getLogger().log(String.valueOf(e));
        }
    }

    private void triggerSuccessResponse(Context context) {
        try {
            SellersApi sellersApi = sellersApi(regionCode, refreshToken);

            ApiResponse<GetMarketplaceParticipationsResponse> httpResult = sellersApi.getMarketplaceParticipationsWithHttpInfo();
            logSuccessResponse(context, httpResult);

        } catch (ApiException e) {
            logApiException(context, e);
        } catch (Exception e) {
            context.getLogger().log(String.valueOf(e));
        }
    }

    private void triggerNotFoundResponse(Context context) {
        try {
            CatalogApi catalogApi = catalogItemsApi(regionCode, refreshToken);

            ApiResponse<Item> httpResult = catalogApi.getCatalogItemWithHttpInfo(
                    INVALID_ASIN,
                    singletonList(marketplaceId),
                    null,
                    null
            );
            logSuccessResponse(context, httpResult);

        } catch (ApiException e) {
            logApiException(context, e);
        } catch (Exception e) {
            context.getLogger().log(String.valueOf(e));
        }
    }

    private void triggerTooManyRequestsResponse(Context context) {
        try {
            ReportsApi reportsApi = reportsApi(regionCode, refreshToken);

            for (int i = 0; i < 20; i++) {
                context.getLogger().log(String.valueOf(i));
                CreateReportSpecification body = new CreateReportSpecification()
                        .reportType(REPORT_TYPE) // Example report type
                        .marketplaceIds(singletonList(marketplaceId)) // Example marketplace ID
                        .dataStartTime(OffsetDateTime.parse("2024-05-01T00:00:00Z")) // Example start time
                        .dataEndTime(OffsetDateTime.parse("2024-05-30T23:59:59Z")); // Example end time
                ApiResponse<CreateReportResponse> httpResult = reportsApi.createReportWithHttpInfo(body);

                logSuccessResponse(context, httpResult);
            }
        } catch (ApiException e) {
            logApiException(context, e);
        } catch (Exception e) {
            context.getLogger().log(String.valueOf(e));
        }
    }

    private <T> void logSuccessResponse(Context context, ApiResponse<T> response) {
        context.getLogger().log("Status Code: " + response.getStatusCode());
        context.getLogger().log("Headers: " + response.getHeaders());
        context.getLogger().log("Data: " + response.getData());
    }

    private void logApiException(Context context, ApiException e) {
        context.getLogger().log("Message: " + e.getMessage());
        context.getLogger().log("Status Code: " + e.getCode());
        JsonObject errorResponse = new Gson().fromJson(e.getResponseBody(), JsonObject.class);
        context.getLogger().log("Body: " + errorResponse);
    }
}
