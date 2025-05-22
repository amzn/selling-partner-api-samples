package org.example;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.networknt.schema.*;

import java.nio.charset.StandardCharsets;
import java.text.MessageFormat;
import java.util.Set;

/**
 * Example validator for the "minUtf8ByteLength" keyword.
 */
public class MinUtf8ByteLengthKeyword extends AbstractKeyword {

    private static final MessageFormat ERROR_MESSAGE_FORMAT =
            new MessageFormat("Value must be greater than or equal {1} bytes in length.");

    private static final String KEYWORD = "minUtf8ByteLength";

    public MinUtf8ByteLengthKeyword() {
        super(KEYWORD);
    }

    @Override
    public JsonValidator newValidator(SchemaLocation schemaLocation, JsonNodePath jsonNodePath, JsonNode schemaNode, JsonSchema parentSchema,
                                      ValidationContext validationContext) {
        // Only process if the provided schema value is a number.
        if (!JsonNodeType.NUMBER.equals(schemaNode.getNodeType())) {
            return null;
        }

        int minUtf8ByteLength = schemaNode.asInt();

        return new AbstractJsonValidator(schemaLocation, jsonNodePath, this, schemaNode) {

            @Override
            public Set<ValidationMessage> validate(ExecutionContext executionContext, JsonNode node, JsonNode rootNode, JsonNodePath jsonNodePath) {

                // Get the value as a string and evaluate its length in bytes.
                String value = node.asText();
                if (value.getBytes(StandardCharsets.UTF_8).length < minUtf8ByteLength) {

                    var validationMessage = ValidationMessage.builder()
                            .type(KEYWORD)
                            .schemaLocation(schemaLocation)
                            .instanceLocation(jsonNodePath)
                            .format(ERROR_MESSAGE_FORMAT)
                            .arguments(jsonNodePath.toString(), Integer.toString(minUtf8ByteLength),
                                    value.getBytes(StandardCharsets.UTF_8).length)
                            .build();
                    return Set.of(validationMessage);
                }
                return Set.of();
            }
        };
    }
}
