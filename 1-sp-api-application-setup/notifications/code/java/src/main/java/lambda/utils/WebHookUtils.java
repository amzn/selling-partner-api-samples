package lambda.utils;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

import static lambda.common.Constants.*;


public class WebHookUtils {

    /**
     * Sends an HTTP POST request with the given payload to the specified webhook URL.
     *
     * This method constructs an HTTP connection, attaches optional authorization headers,
     * sends the payload, and checks for a successful (2xx) response.
     *
     * @param webhookUrl the destination webhook URL
     * @param payload    the JSON payload to send
     * @param authToken  optional authentication token to include in the request
     * @param authHeader optional name of the header to use for the auth token (defaults to "Authorization: Bearer ...")
     * @throws Exception if the HTTP request fails or returns a non-2xx response
     */
    public static void sendWebhookRequest(String payload) throws Exception {

        String webHookUrl = System.getenv(WEB_HOOK_URL_ENV_VARIABLE);
        String authToken = System.getenv(WEB_HOOK_AUTH_TOKEN_ENV_VARIABLE);
        String authHeader = System.getenv(WEB_HOOK_AUTH_HEADER_NAME_ENV_VARIABLE);

        // Open an HTTP connection to the webhook URL
        HttpURLConnection connection = createConnection(webHookUrl, authToken, authHeader);

        // Write the payload to the request body
        try (OutputStream os = connection.getOutputStream()) {
            os.write(payload.getBytes(StandardCharsets.UTF_8));
        }

        // Get and check the response code
        int responseCode = connection.getResponseCode();

        // If response code indicates failure (non-2xx), throw an exception
        if (responseCode >= 300) {
            throw new RuntimeException("Failed with HTTP error code : " + responseCode);
        }
    }

    /**
     * Creates and configures an HttpURLConnection for a POST request to the specified webhook URL.
     *
     * @param webhookUrl the destination webhook URL
     * @param authToken  optional authentication token
     * @param authHeader optional name of the header to use for the auth token
     * @return a configured HttpURLConnection instance
     * @throws Exception if the connection setup fails
     */
    private static HttpURLConnection createConnection(String webhookUrl, String authToken, String authHeader) throws Exception {
        URL url = new URL(webhookUrl);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();

        connection.setRequestMethod("POST");
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json");

        if (authToken != null && !authToken.isEmpty()) {
            if (authHeader != null && !authHeader.isEmpty()) {
                connection.setRequestProperty(authHeader, authToken);
            } else {
                connection.setRequestProperty("Authorization", "Bearer " + authToken);
            }
        }

        return connection;
    }
}
