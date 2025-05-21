package org.example;
import com.amazon.SellingPartnerAPIAA.LWAException;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.listings.restrictions.v2021_08_01.ListingsApi;
import software.amazon.spapi.models.listings.restrictions.v2021_08_01.Restriction;
import software.amazon.spapi.models.listings.restrictions.v2021_08_01.RestrictionList;

import static org.example.Main.*;

public class ListingRestrictionsApiHelper {

    private static ListingsApi listingRestrictionsApi;

    public static void initListingRestrictionsApi() {
        listingRestrictionsApi = new software.amazon.spapi.api.listings.restrictions.v2021_08_01.ListingsApi.Builder()
                .lwaAuthorizationCredentials(lwaAuthorizationCredentials)
                .endpoint(endpoint)
                .build();
    }

    public static void findListingRestrictions(String asin) throws LWAException, ApiException {
        String reasonLocale = "en_US"; // Optional: for localized restriction messages

        // Call the API to get listing restrictions
        try {
            RestrictionList restrictions = listingRestrictionsApi.getListingsRestrictions(
                    asin,
                    sellerId,
                    marketPlaceIds,
                    null, // Can be null to check all conditions
                    reasonLocale
            );

            // Process the restrictions
            if (restrictions != null && restrictions.getRestrictions() != null && !restrictions.getRestrictions().isEmpty()) {
                System.out.println("Found " + restrictions.getRestrictions().size() + " restrictions for ASIN: " + asin);

                // Print details of each restriction
                for (Restriction restriction : restrictions.getRestrictions()) {
                    System.out.println("Marketplace: " + restriction.getMarketplaceId());
                    System.out.println("Condition: " + restriction.getConditionType());

                    // Print reasons for restrictions
                    restriction.getReasons().forEach(reason -> {
                        System.out.println("Reason Code: " + reason.getReasonCode());
                        System.out.println("Message: " + reason.getMessage());

                        // Print links for approval if available
                        if (reason.getLinks() != null && !reason.getLinks().isEmpty()) {
                            reason.getLinks().forEach(link -> {
                                System.out.println("Approval Link: " + link.getResource());
                                System.out.println("Link Title: " + link.getTitle());
                            });
                        }
                    });
                    System.out.println("-------------------");
                }
            } else {
                System.out.println("No restrictions found for ASIN: " + asin);
            }
        } catch (ApiException e) {
            System.err.println("Exception when calling getRestrictions");
            System.err.println("Status code: " + e.getCode());
            System.err.println("Reason: " + e.getResponseBody());
            System.err.println("Response headers: " + e.getResponseHeaders());
            throw e;
        }
    }

}
