package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.google.common.collect.Lists;

import java.util.Map;

import static lambda.utils.ApiUtils.*;
import static lambda.utils.Constants.REFRESH_TOKEN_KEY_NAME;
import static lambda.utils.Constants.REGION_CODE_KEY_NAME;
import com.google.gson.Gson;
import com.google.gson.JsonObject;
import io.swagger.client.ApiException;
import io.swagger.client.ApiResponse;
import io.swagger.client.api.CatalogApi;
import io.swagger.client.model.CatalogApi.ItemSearchResults;
import io.swagger.client.model.ListingsApi.Item;
import io.swagger.client.model.ReportsApi.CreateReportResponse;
import io.swagger.client.model.ReportsApi.CreateReportSpecification;
import io.swagger.client.model.SellersApi.GetMarketplaceParticipationsResponse;

import io.swagger.client.api.SellersApi;
import io.swagger.client.api.ListingsApi;
import io.swagger.client.api.ReportsApi;

import lambda.utils.Constants;
import org.threeten.bp.OffsetDateTime;


import java.util.Arrays;
import java.util.List;
import static lambda.utils.Constants.*;

public class ErrorMonitoringHandler implements RequestHandler<Map<String, String>, String> {


    public String handleRequest(Map<String, String> input, Context context) {
        context.getLogger().log("Input: " + input);

        String regionCode = NA_REGION_CODE;
        String refreshToken = System.getenv("REFRESH_TOKEN");

        //Multiple try catch blocks to test different 4xx errors

        try {
            // Test 400 Error
            CatalogApi catalogApi = catalogItemsApi(regionCode, refreshToken);

            String identifiersType = "ASINS";
            List<String> includedData = Arrays.asList("relationships", "attributes", "dimensions", "identifiers", "images", "productTypes", "salesRanks", "summaries");
            List<String> identifiers = Arrays.asList(TEST_IDENTIFIER);
            List<String> marketplaceIds = Arrays.asList(US_MARKETPLACE_ID);

            ApiResponse<ItemSearchResults> httpResult = catalogApi.searchCatalogItemsWithHttpInfo(marketplaceIds, identifiers, identifiersType, includedData, null, null, null, null, null, null, null, null);
            context.getLogger().log("Status Code: " + httpResult.getStatusCode());
            context.getLogger().log("Headers: " + httpResult.getHeaders());
            context.getLogger().log("Data: " + httpResult.getData());


        } catch (ApiException e) {

            context.getLogger().log("Status Code: " + e.getCode());
            JsonObject errorResponse = new Gson().fromJson(e.getResponseBody(), JsonObject.class);
            context.getLogger().log("Body: " + errorResponse);
        } catch (Exception e) {

            context.getLogger().log(String.valueOf(e));
        }

        try {
            //Test 200 call
            SellersApi sellersApi = sellersApi(regionCode, refreshToken);

            ApiResponse<GetMarketplaceParticipationsResponse> httpResult = sellersApi.getMarketplaceParticipationsWithHttpInfo();

            context.getLogger().log("Status Code: " + httpResult.getStatusCode());
            context.getLogger().log("Headers: " + httpResult.getHeaders());
            context.getLogger().log("Data: " + httpResult.getData());


        } catch (ApiException e) {

            context.getLogger().log("Message: " + e.getMessage());
            context.getLogger().log("Status Code: " + e.getCode());
            JsonObject errorResponse = new Gson().fromJson(e.getResponseBody(), JsonObject.class);
            context.getLogger().log("Body: " + errorResponse);
        } catch (Exception e) {

            context.getLogger().log(String.valueOf(e));
        }



        try {
            //Test 404 Error
            ListingsApi listingsApi = listingsApi(regionCode, refreshToken);

            String sellerId = SELLER_ID;
            String sku = SKU;
            List<String> includedData = Arrays.asList("issues", "attributes", "offers", "fulfillmentAvailability", "procurement", "summaries");
            List<String> marketplaceIds = Arrays.asList(US_MARKETPLACE_ID);

            ApiResponse<Item> httpResult = listingsApi.getListingsItemWithHttpInfo(sellerId, sku, marketplaceIds, null, includedData);

            context.getLogger().log("Status Code: " + httpResult.getStatusCode());
            context.getLogger().log("Headers: " + httpResult.getHeaders());
            context.getLogger().log("Data: " + httpResult.getData());

        } catch (ApiException e) {

            context.getLogger().log("Message: " + e.getMessage());
            context.getLogger().log("Status Code: " + e.getCode());
            JsonObject errorResponse = new Gson().fromJson(e.getResponseBody(), JsonObject.class);
            context.getLogger().log("Body: " + errorResponse);
        } catch (Exception e) {

            context.getLogger().log(String.valueOf(e));
        }

        try {
            //Test 429 Error
            ReportsApi reportsApi = reportsApi(regionCode, refreshToken);

            for (int i = 0; i < 20; i++) {
                context.getLogger().log(String.valueOf(i));
                CreateReportSpecification body = new CreateReportSpecification()
                        .reportType(REPORT_TYPE) // Example report type
                        .marketplaceIds(Arrays.asList(US_MARKETPLACE_ID)) // Example marketplace ID
                        .dataStartTime(OffsetDateTime.parse("2024-05-01T00:00:00Z")) // Example start time
                        .dataEndTime(OffsetDateTime.parse("2024-05-30T23:59:59Z")); // Example end time
                ApiResponse<CreateReportResponse> httpResult = reportsApi.createReportWithHttpInfo(body);

                context.getLogger().log("Status Code: " + httpResult.getStatusCode());
                context.getLogger().log("Headers: " + httpResult.getHeaders());
                context.getLogger().log("Data: " + httpResult.getData());

            }
        } catch (ApiException e) {

            context.getLogger().log("Message: " + e.getMessage());
            context.getLogger().log("Status Code: " + e.getCode());
            JsonObject errorResponse = new Gson().fromJson(e.getResponseBody(), JsonObject.class);
            context.getLogger().log("Body: " + errorResponse);
        } catch (Exception e) {

            System.out.println(e);
        }

        return "Success!";
    }

}
