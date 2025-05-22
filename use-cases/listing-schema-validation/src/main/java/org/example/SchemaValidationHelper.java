package org.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonMetaSchema;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.ValidationMessage;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * This class contains helper methods to validate listing payload that sellers submit to Amazon through listing API
 *  The validation meta schema is based on the standardized V2019 JsonMetaSchema.
 *  But it also tailored to reflect the SP-API specific requirement: https://schemas.amazon.com/selling-partners/definitions/product-types/meta-schema/v1
 *  It should meet SP-API listing specific requirement such as MaxUniqueItemsKeyword, MaxUtf8ByteLengthKeyword, MinUtf8ByteLengthKeyword
 *    these requirements are reflected in each of the class that you can find within this sample solution project.
 *  Lastly, the result meta schema should also check for specific product type meta schema specification
 *
 */
public class SchemaValidationHelper {

    // SP-API specific meta schema definition
    private static String metaSchemaId = "https://schemas.amazon.com/selling-partners/definitions/product-types/meta-schema/v1";

    // Keywords that are informational only and do not require validation.
    private static Set<String> excludeKeywords = new HashSet<>(Arrays.asList("editable", "enumNames"));


    /***
     *
     * @param metaSchemaLocalPath the local path of the product type specific meta schema json file. You could get this json
     *                            by making SP-API getProductTypeDefinition request
     * @return
     * @throws IOException
     */
    public static JsonSchemaFactory getMetaSchemaJsonFactory(String metaSchemaLocalPath) throws IOException {


        // Step 1: Create a standardized json meta schema
        JsonMetaSchema standardMetaSchema = JsonMetaSchema.getV201909();


        // Step 2: Update the meta schema to reflect SP-API specific requirements.
        JsonMetaSchema metaSchema = JsonMetaSchema.builder(metaSchemaId, standardMetaSchema)
                .addKeywords(standardMetaSchema.getKeywords().entrySet().stream()
                        .filter(entry -> !excludeKeywords.contains(entry.getKey()))
                        .map(Map.Entry::getValue)
                        .collect(Collectors.toSet()))
                .addKeyword(new MaxUniqueItemsKeyword())
                .addKeyword(new MaxUtf8ByteLengthKeyword())
                .addKeyword(new MinUtf8ByteLengthKeyword())
                .build();


        // Step 3: build a listing product type specific meta schema
        String customMetaSchemaJson = new String(Files.readAllBytes(Paths.get(metaSchemaLocalPath)));
        JsonMetaSchema customMetaSchema = new JsonMetaSchema.Builder(customMetaSchemaJson)
                .addKeywords(metaSchema.getKeywords().values()) // Include standard keywords
                .build();


        // Step 4: Combine the schema from step 2 and 3 to create a finalized meta schema validator
        JsonSchemaFactory metaSchemaFactory = new JsonSchemaFactory.Builder()
                .defaultMetaSchemaIri(metaSchemaId)
                .addMetaSchema(metaSchema)
                .addMetaSchema(customMetaSchema)
                .build();
        return metaSchemaFactory;
    }


    /***
     * Generate actual schema object based on the schema json file and metaSchemaFactory
     * @param schemaLocalPath
     * @param metaSchemaFactory
     * @return
     * @throws IOException
     */
    public static JsonSchema getProductTypeSchema(String schemaLocalPath, JsonSchemaFactory metaSchemaFactory) throws IOException {
        JsonSchema schema = metaSchemaFactory.getSchema(new String(Files.readAllBytes(Paths.get(schemaLocalPath))));
        return schema;
    }


    /**
     * Validate payload populated by sellers given both the schema and payload json file
     * @param payloadLocalPath
     * @param schema
     * @return
     * @throws IOException
     */
    public static String validatePayload(String payloadLocalPath, JsonSchema schema) throws IOException {
        JsonNode payload = new ObjectMapper().readValue(new File(payloadLocalPath), JsonNode.class);
        String payloadStr = new String(Files.readAllBytes(Paths.get(payloadLocalPath)));
        Set<ValidationMessage> messages = schema.validate(payload);
        if (messages.size() == 0) {
            System.out.println("The payload you provided passed the validation for product type");
            return payloadStr;
        }
        for (ValidationMessage message : messages) {
            System.out.println(message.getError());
            System.out.println(message.getSchemaLocation());
            System.out.println(message.getEvaluationPath());
            System.out.println(message.getInstanceLocation());
            System.out.println(message.getInstanceNode());
            System.out.println(message.getMessageKey());
        }
        return null;
    }

}
