package org.example;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeType;
import com.networknt.schema.AbstractJsonValidator;
import com.networknt.schema.AbstractKeyword;
import com.networknt.schema.ExecutionContext;
import com.networknt.schema.JsonNodePath;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaException;
import com.networknt.schema.JsonValidator;
import com.networknt.schema.SchemaLocation;
import com.networknt.schema.ValidationContext;
import com.networknt.schema.ValidationMessage;
import java.text.MessageFormat;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.lang3.StringUtils;

/**
 * Example validator for the "maxUniqueItems" keyword.
 */
public class MaxUniqueItemsKeyword extends AbstractKeyword {

    private static final MessageFormat ERROR_MESSAGE_FORMAT = new MessageFormat("{1}: Each combination of selector "
            + "values may only occur {2} times. The following selector value combination occurs too many times: {3}");

    private static final String KEYWORD = "maxUniqueItems";
    private static final String SELECTORS = "selectors";

    public MaxUniqueItemsKeyword() {
        super(KEYWORD);
    }

    @Override
    public JsonValidator newValidator(SchemaLocation schemaLocation, JsonNodePath jsonNodePath, JsonNode schemaNode,
                                      JsonSchema parentSchema, ValidationContext validationContext) throws JsonSchemaException, Exception {
        // Only process if the provided schema value is a number.
        if (!JsonNodeType.NUMBER.equals(schemaNode.getNodeType())) {
            return null;
        }

        var maxUniqueItems = schemaNode.asInt();

        // Get the selector properties configured on the scheme element, if they exist. Otherwise, this validator
        // defaults to using all properties.
        var selectors = getSelectorProperties(parentSchema);

        return new AbstractJsonValidator(schemaLocation, jsonNodePath, this, schemaNode) {
            @Override
            public Set<ValidationMessage> validate(ExecutionContext executionContext, JsonNode node, JsonNode rootNode,
                                                   JsonNodePath jsonNodePath) {
                // Only process if the node is an array, as selectors and unique items do not apply to other data
                // types.
                if (node.isArray()) {
                    // Create a property-value map of each items properties (selectors) and count the number of
                    // occurrences for each combination.
                    var uniqueItemCounts = new HashMap<Map<String, String>, Integer>();
                    node.forEach(instance -> {
                        // Only process instances that are objects.
                        if (instance.isObject()) {
                            Map<String, String> uniqueKeys = new HashMap<>();

                            Iterator<Map.Entry<String, JsonNode>> fieldIterator = instance.fields();
                            while (fieldIterator.hasNext()) {
                                Map.Entry<String, JsonNode> entry = fieldIterator.next();
                                // If no selectors are configured, always add. Otherwise only add if the property is
                                // a selector.
                                if (selectors.isEmpty() || selectors.contains(entry.getKey())) {
                                    uniqueKeys.put(entry.getKey(), entry.getValue().asText());
                                }
                            }

                            // Iterate count and put in counts map.
                            int count = uniqueItemCounts.getOrDefault(uniqueKeys, 0) + 1;
                            uniqueItemCounts.put(uniqueKeys, count);
                        }
                    });

                    // Find first selector combination with too many instances.
                    var uniqueKeysWithTooManyItems = uniqueItemCounts.entrySet().stream()
                            .filter(entry -> entry.getValue() > maxUniqueItems)
                            .map(Map.Entry::getKey)
                            .findFirst();

                    // Return a failed validation if a selector combination has too many instances.
                    if (uniqueKeysWithTooManyItems.isPresent()) {
                        var validationMessage = ValidationMessage.builder()
                                .type(KEYWORD)
                                .schemaLocation(schemaLocation)
                                .instanceLocation(jsonNodePath)
                                .format(ERROR_MESSAGE_FORMAT)
                                .arguments(jsonNodePath.toString(), Integer.toString(maxUniqueItems),
                                        uniqueKeysWithTooManyItems.get().toString())
                                .build();
                        return Set.of(validationMessage);
                    }
                }

                return Set.of();
            }
        };
    }

    private Set<String> getSelectorProperties(JsonSchema parentSchema) {
        if (parentSchema.getSchemaNode().has(SELECTORS) && parentSchema.getSchemaNode().get(SELECTORS).isArray()) {
            var selectors = new HashSet<String>();
            parentSchema.getSchemaNode().get(SELECTORS).forEach(node -> selectors.add(node.asText()));
            return selectors.stream().filter(StringUtils::isNotBlank).collect(Collectors.toSet());
        }
        return new HashSet<>();
    }

}

