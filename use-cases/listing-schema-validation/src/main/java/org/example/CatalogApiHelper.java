package org.example;

import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.catalogitems.v2022_04_01.CatalogApi;
import software.amazon.spapi.models.catalogitems.v2022_04_01.Item;
import software.amazon.spapi.models.catalogitems.v2022_04_01.ItemSearchResults;

import java.util.List;

import static org.example.Main.apiClient;

public class CatalogApiHelper {

    private static CatalogApi catalogApi;

    public static void initCatalogApi() {
        catalogApi = new CatalogApi(apiClient, true);
    }
    public static CatalogApi getCatalogApi() {
        return catalogApi;
    }

    /**
     * check product in catalog or not based on keywords.
     * @param keywords
     * @param catalogIncludedData
     * @return
     * @throws LWAException
     * @throws ApiException
     */
    public static List<Item> isProductInCatalogAlready(List<String> keywords, List<String> catalogIncludedData) throws LWAException, ApiException {

        // Search for the product in the catalog
        try {
            ItemSearchResults results = catalogApi.searchCatalogItems(
                    Main.marketPlaceIds,
                    null,
                    null, // identifiers not used together with keywords
                    catalogIncludedData,
                    null, // locale
                    null, // sellerId
                    keywords,
                    null, // brandNames
                    null,
                    1,
                    null,
                    null);

            // Check if any items were found
            if (results != null && results.getItems() != null && !results.getItems().isEmpty()) {
                System.out.println("Product found in catalog with ASIN: " + results.getItems().get(0).getAsin());
                return results.getItems();
            }
            return null;
        } catch (ApiException e) {
            System.err.println("Exception when calling searchCatalogItems");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            for (StackTraceElement element : e.getStackTrace()) {
                System.out.println(element.toString());
            }
            System.err.println("Response headers: " + e.getResponseHeaders());
            throw e;
        }
    }
}
