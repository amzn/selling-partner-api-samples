package org.example;
import com.google.gson.Gson;
import com.amazon.SellingPartnerAPIAA.LWAAuthorizationCredentials;
import com.amazon.SellingPartnerAPIAA.LWAException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.reflect.TypeToken;
import com.networknt.schema.*;
import org.yaml.snakeyaml.Yaml;
import software.amazon.spapi.ApiException;
import software.amazon.spapi.api.catalogitems.v2022_04_01.CatalogApi;
import software.amazon.spapi.api.producttypedefinitions.v2020_09_01.DefinitionsApi;
import software.amazon.spapi.api.sellers.v1.SellersApi;
import software.amazon.spapi.models.catalogitems.v2022_04_01.Item;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemPutRequest;
import software.amazon.spapi.models.listings.items.v2021_08_01.ListingsItemSubmissionResponse;
import software.amazon.spapi.models.listings.restrictions.v2021_08_01.Restriction;
import software.amazon.spapi.models.listings.restrictions.v2021_08_01.RestrictionList;
import software.amazon.spapi.models.producttypedefinitions.v2020_09_01.ProductType;
import software.amazon.spapi.models.producttypedefinitions.v2020_09_01.ProductTypeDefinition;
import software.amazon.spapi.models.producttypedefinitions.v2020_09_01.ProductTypeList;
import software.amazon.spapi.models.sellers.v1.GetMarketplaceParticipationsResponse;
import software.amazon.spapi.models.catalogitems.v2022_04_01.ItemSearchResults;
import software.amazon.spapi.api.listings.items.v2021_08_01.ListingsApi;

import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Type;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;
import java.util.stream.Collectors;

/***
 * This class shows an example to create a new listing from the beginning. It covers
 * How to get the product type
 * How to extract the product type meta schema json and schema json
 * How to validate the payload against product type schema
 * How to submit listing under preview mode
 * More details about SP-API product type definitions and schema check details can be found here:
 * https://developer-docs.amazon.com/sp-api/docs/product-type-definition-meta-schema
 * More details about listing cane be found here
 * https://developer-docs.amazon.com/sp-api/docs/building-listings-management-workflows-guide
 */
public class Main {

    private static String clientId;
    private static String clientSecret;
    private static String refreshToken;
    public  static String endpoint;
    public static List<String> marketPlaceIds;
    public static String sellerId;
    public static String sku;
    public static LWAAuthorizationCredentials lwaAuthorizationCredentials;



    public static void main(String[] args) throws LWAException, ApiException, IOException, InterruptedException {
        System.out.println("Listing Schema validation Sample App Started");

        // Populate param values such as refreshTokens and marketplaceIds from config file
        String configPath = "./config.yml";
        populateConfigs(configPath);

        // initialize LWA credentials and API clients
        initializeApiClients(configPath);


        // check the product already exist in the Amazon catalog or not
        List<String> keywords = Arrays.asList("luggage");
//        List<String> catalogIncludedData = Arrays.asList("summaries", "attributes");
//        boolean productExist = false;
//        List<Item> catalogItems = CatalogApiHelper.isProductInCatalogAlready(keywords, catalogIncludedData);
//        if (catalogItems != null) {
//            String sampleAsin = catalogItems.get(0).getAsin().toString();
//            ListingRestrictionsApiHelper.findListingRestrictions(sampleAsin);
//        }


        // get the Product Type using the keywords you like, there could be multiple product type show up
        // pick the one you think most appropriate, here I just pick first one
        ProductTypeList productTypes = DefinitionsApiHelper.searchProductTypes(keywords);
        String productType = productTypes.getProductTypes().get(0).getName();


        // Get Product Type Definition，which you can extract out both the meta schema link and schema link
        ProductTypeDefinition definition = DefinitionsApiHelper.getProductTypeDefinition(productType);
        // extract out the schema url and meta schema url
        String metaSchemaUrl = definition.getMetaSchema().getLink().getResource();
        String schemaUrl = definition.getSchema().getLink().getResource();


        // Store both json schema file into locally
        String metaSchemaLocalPath = "./metaSchema.json";
        String schemaLocalPath = "./schema.json";
        getSchemaAndStoreLocally(metaSchemaUrl, metaSchemaLocalPath);
        getSchemaAndStoreLocally(schemaUrl, schemaLocalPath);


        // generate metaSchemaFactory based on meta schema json file
        JsonSchemaFactory metaSchemaFactory = SchemaValidationHelper.getMetaSchemaJsonFactory(metaSchemaLocalPath);


        // build customized schema object based on the product type specific schema json file and metaSchemaFactory
        JsonSchema schema = SchemaValidationHelper.getProductTypeSchema(schemaLocalPath, metaSchemaFactory);


        // validate the payload against the product type schema to find out syntax error if any
        // The payload values can be populated using website like https://rjsf-team.github.io/react-jsonschema-form/ given the schema json
        String payloadLocalPath = "./payload.json";
        String payloadStr = SchemaValidationHelper.validatePayload(payloadLocalPath, schema);


        // Put listing item in validation mode to check any errors that not caught using the open resourced json validator library
        ListingApiHelper.putListingsItemValidationMode(payloadStr, productType);

    }

    public static void initializeApiClients(String configPath) throws IOException {
        // Configure your LWA credentials
        lwaAuthorizationCredentials = LWAAuthorizationCredentials.builder()
                .clientId(clientId)
                .clientSecret(clientSecret)
                .refreshToken(refreshToken)
                .endpoint("https://api.amazon.com/auth/o2/token")
                .build();

        CatalogApiHelper.initCatalogApi();
        DefinitionsApiHelper.initDefinitionsApi();
        ListingApiHelper.initListingsApi();
        ListingRestrictionsApiHelper.initListingRestrictionsApi();
    }

    public static void populateConfigs(String configPath) throws IOException {
        InputStream inputStream = Files.newInputStream(Paths.get(configPath));
        Yaml yaml = new Yaml();
        Map<String, Object> yamlData = yaml.load(inputStream);
        clientId = (String) yamlData.get("clientId");
        clientSecret = (String) yamlData.get("clientSecret");
        refreshToken = (String) yamlData.get("refreshToken");
        endpoint = (String) yamlData.get("endpoint");
        // For the list of marketplace IDs
        marketPlaceIds = (List<String>) yamlData.get("marketPlaceIds");
        sellerId = (String) yamlData.get("sellerId");
        sku = (String) yamlData.get("sku");
    }

    public static void getSchemaAndStoreLocally(String url, String localPath) throws IOException, InterruptedException {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest schemaRequest = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();
        HttpResponse<String> schemaResponse = client.send(schemaRequest, HttpResponse.BodyHandlers.ofString());
        String schemaJson = schemaResponse.body();
        Files.write(Paths.get(localPath), schemaJson.getBytes());
    }


}