package org.example;

import com.amazon.SellingPartnerAPIAA.LWAException;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.listings.items.v2021_08_01.ListingsApi;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemPutRequest;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemSubmissionResponse;

import java.io.IOException;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;

import static org.example.Main.*;

public class ListingApiHelper {

    private static ListingsApi listingsApi;

    public static void initListingsApi() {
        listingsApi = new ListingsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(endpoint)
                .build();
    }

    /***
     * when request in validationMode, the request would not have any impact but to helper developer or seller
     * to identify any syntax errors of their json payload against the product type schema.
     * Notice that this request is to listing new product only, if you want to create a new offer or update an existing
     * listing item, do not use this method
     * @param payloadStr the json file values populated by sellers
     * @param productType
     * @return
     * @throws IOException
     * @throws ApiException
     * @throws LWAException
     */
    public static ListingsItemSubmissionResponse putListingsItemValidationMode(String payloadStr, String productType) throws IOException, ApiException, LWAException {
        ListingsApi listingsApi = new ListingsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(endpoint)
                .build();
        Gson gson = new Gson();
        Type type = new TypeToken<HashMap<String, Object>>(){}.getType();
        ListingsItemPutRequest putRequest = new ListingsItemPutRequest();
        putRequest.setAttributes(gson.fromJson(payloadStr, type));
        putRequest.setRequirements(ListingsItemPutRequest.RequirementsEnum.LISTING_PRODUCT_ONLY);
        putRequest.setProductType(productType);
        try {
            List<String> putIncludedData = Arrays.asList("identifiers", "issues");
            ListingsItemSubmissionResponse listingsItem = listingsApi.putListingsItem(
                    putRequest,
                    sellerId,
                    sku,
                    marketPlaceIds,
                    putIncludedData,
                    "VALIDATION_PREVIEW",
                    "en_US"
            );
            System.out.println("validation mode Listing Status: " + listingsItem.getStatus());
            System.out.println("validation mode Listing issues: " + listingsItem.getIssues());
            return listingsItem;
        } catch (ApiException e) {
            System.err.println("Exception when calling listingsApi.putListingsItem");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            System.err.println("Response headers: " + e.getResponseHeaders());
            throw e;
        }
    }

}
