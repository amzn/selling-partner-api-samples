package org.example;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.producttypedefinitions.v2020_09_01.DefinitionsApi;
import software.amazon.spapi.models.producttypedefinitions.v2020_09_01.ProductTypeDefinition;
import software.amazon.spapi.models.producttypedefinitions.v2020_09_01.ProductTypeList;

import java.util.List;

import static org.example.Main.*;

public class DefinitionsApiHelper {

    private static DefinitionsApi definitionsApi;

    public static void initDefinitionsApi() {
        definitionsApi = new DefinitionsApi(apiClient, true);
    }


    public static ProductTypeList searchProductTypes(List<String> ptKeywords) throws LWAException, ApiException {
        // Initialize the Product Type Definitions API client
        DefinitionsApi definitionsApi = new DefinitionsApi(apiClient, true);

        // Set up request parameters
        String locale = "en_US"; // For localized attribute names
        String searchLocale = "en_US"; // For search terms
        try {
            // Call the API with keywords
            System.out.println("Calling searchDefinitionsProductTypes with keywords: " + String.join(", ", ptKeywords));
            return definitionsApi.searchDefinitionsProductTypes(
                    marketPlaceIds,
                    ptKeywords,
                    null, // itemName (not used when searching by keywords)
                    locale,
                    searchLocale
            );
        } catch (ApiException e) {
            System.err.println("Exception when calling ProductTypeDefinitionsApi#searchDefinitionsProductTypes");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            System.err.println("Response headers: " + e.getResponseHeaders());
            throw e;
        }
    }

    public static ProductTypeDefinition getProductTypeDefinition(String productType) throws LWAException, ApiException {

        String requirementsEnforced = "NOT_ENFORCED"; // ENFORCED or NOT_ENFORCED
        String requirements = "LISTING_PRODUCT_ONLY";
        System.out.println("Calling getDefinitionsProductType for product type: " + productType);
        try {
            ProductTypeDefinition definition = definitionsApi.getDefinitionsProductType(
                    productType,
                    marketPlaceIds,
                    null,
                    null,
                    requirements,
                    requirementsEnforced,
                    "en_US");
            System.out.println("Meta Schema Link: " + definition.getMetaSchema().getLink());
            System.out.println("Schema Link: " + definition.getSchema().getLink());
            return definition;
        } catch (ApiException e) {
            System.err.println("Exception when calling ProductTypeDefinitionsApi#getDefinitionsProductType");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            System.err.println("Response headers: " + e.getResponseHeaders());
            throw e;
        }
    }

}
