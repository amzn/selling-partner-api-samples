package lambda.utils;

import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.fasterxml.jackson.core.type.TypeReference;
import com.google.gson.Gson;
import lambda.common.ClientCredentials;
import software.amazon.awssdk.services.secretsmanager.SecretsManagerClient;
import software.amazon.awssdk.services.secretsmanager.model.GetSecretValueRequest;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;

public class SecretManagerUtils {

    private static final SecretsManagerClient secretsClient = SecretsManagerClient.create();
    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final Gson gson = new Gson();

    /**
     * Retrieves the plaintext secret value from AWS Secrets Manager for the given secret ID.
     *
     * <p>This method initializes a {@link SecretsManagerClient}, sends a request to fetch the secret value,
     * and returns the secret's string content. It is assumed that the secret value is stored as a string
     * and not as binary data.</p>
     *
     * @param secretId The identifier (name or ARN) of the secret to retrieve
     * @return The secret value as a plain text string
     * @throws software.amazon.awssdk.services.secretsmanager.model.SecretsManagerException
     *         if the secret cannot be retrieved
     */
    public static String getSecretString(String secretId) {
        return secretsClient.getSecretValue(
                GetSecretValueRequest.builder().secretId(secretId).build()
        ).secretString();
    }

    /**
     * Retrieves a combined map of seller IDs to their corresponding secret ARNs from AWS Secrets Manager.
     *
     * <p>This method expects a comma-separated list of secret names to be present in the environment
     * variable specified by {@code SP_API_APP_CREDENTIALS_SECRET_ARN_ENV_VARIABLE}. Each secret should
     * contain a JSON array of key-value pairs, where the key is a {@code sellerId} and the value is
     * the corresponding secret ARN.</p>
     *
     * <p>All mappings from each secret are merged into a single map. If the environment variable is
     * missing or empty, an empty map is returned.</p>
     *
     * @param logger The Lambda logger used for debug output
     * @param secretNamesEnv A comma-separated string of secret names to retrieve and merge
     * @return A map of sellerId to secretArn
     * @throws IOException if secret content cannot be parsed
     */
    public static Map<String, String> fetchCombinedSecretsMap(LambdaLogger logger, String secretNamesEnv) throws IOException {
        if (secretNamesEnv == null || secretNamesEnv.isEmpty()) {
            logger.log("AGGREGATED_SECRET_NAMES is empty or missing");
            return Collections.emptyMap();
        }

        String[] secretNames = secretNamesEnv.split(",");
        Map<String, String> combinedSecretsMap = new HashMap<>();

        for (String secretName : secretNames) {
            logger.log("Fetching secret: " + secretName);
            String secretString = SecretManagerUtils.getSecretString(secretName);

            List<Map<String, String>> secretsList = objectMapper.readValue(
                    secretString, new TypeReference<>() {}
            );

            secretsList.forEach(combinedSecretsMap::putAll);
        }

        return combinedSecretsMap;
    }

    /**
     * Asynchronously fetches {@link ClientCredentials} for the given list of seller IDs using
     * AWS Secrets Manager, based on a provided mapping of seller IDs to their secret ARNs.
     *
     * <p>This method uses a fixed-size thread pool and {@link CompletableFuture} to fetch credentials
     * in parallel, improving performance for scenarios with many sellers.</p>
     *
     * <p>If a seller ID does not have a corresponding secret ARN in {@code combinedSecretsMap},
     * it is skipped and a message is logged. If an error occurs during secret retrieval or parsing,
     * the error is logged and that entry is excluded from the result.</p>
     *
     * @param sellerIds A list of seller IDs for which credentials should be retrieved
     * @param combinedSecretsMap A map of seller ID to its corresponding secret ARN
     * @param logger A Lambda logger for debug and error messages
     * @return A set of successfully fetched {@link ClientCredentials}; entries with missing or invalid secrets are skipped
     */
    public static Set<ClientCredentials> fetchCredentialsForSellers(
            List<String> sellerIds,
            Map<String, String> combinedSecretsMap,
            LambdaLogger logger) {

        ExecutorService executor = Executors.newFixedThreadPool(Math.min(sellerIds.size(), 10));
        List<CompletableFuture<ClientCredentials>> futures = sellerIds.stream()
                .map(sellerId -> CompletableFuture.supplyAsync(() -> {
                    String credentialsSecretArn = combinedSecretsMap.get(sellerId);
                    if (credentialsSecretArn == null) {
                        logger.log("No credentials found for sellerId: " + sellerId);
                        return null;
                    }
                    try {
                        logger.log("Credentials fetched for sellerId: " + sellerId);
                        return SecretManagerUtils.getSecretCredentials(credentialsSecretArn);
                    } catch (Exception e) {
                        logger.log("Failed to fetch credentials for sellerId: " + sellerId + " - " + e.getMessage());
                        return null;
                    }
                }, executor))
                .toList();

        // Collect the result
        Set<ClientCredentials> credentialsSet = futures.stream()
                .map(CompletableFuture::join)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        executor.shutdown();
        return credentialsSet;
    }

    /**
     * Retrieves and parses SP-API client credentials from AWS Secrets Manager.
     *
     * <p>This method fetches the secret value corresponding to the provided
     * secret ARN and deserializes it into a {@link ClientCredentials} object
     * using Gson.</p>
     *
     * @param credentialsSecretArn The full ARN of the secret stored in AWS Secrets Manager.
     *                             This secret must contain a JSON structure compatible with {@link ClientCredentials}.
     * @return A {@link ClientCredentials} object containing ClientId, ClientSecret, RefreshToken, etc.
     * @throws RuntimeException if the secret cannot be retrieved or parsed.
     */
    public static ClientCredentials getSecretCredentials(String credentialsSecretArn) {
        String credentialsSecretString = SecretManagerUtils.getSecretString(credentialsSecretArn);
        return gson.fromJson(credentialsSecretString, ClientCredentials.class);
    }
}
