package lambda.utils;

import java.io.*;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.zip.GZIPInputStream;
import com.squareup.okhttp.*;

public class HttpFileTransferUtil {

    private static final OkHttpClient httpClient = new OkHttpClient();

    /**
     * Downloads a document from the specified URL and returns it as an InputStream.
     *
     * @param url The URL to download the document from.
     * @param compressionAlgorithm The compression algorithm to use (e.g., "GZIP").
     * @return An InputStream containing the downloaded document.
     * @throws IOException If there is an error during download.
     * @throws IllegalArgumentException If the character set or compression algorithm is invalid.
     */
    public static InputStream download(String url, String compressionAlgorithm) throws IOException, IllegalArgumentException {
        Request request = new Request.Builder()
                .url(url)
                .get()
                .build();

        Response response = httpClient.newCall(request).execute();
        if (!response.isSuccessful()) {
            String errorMessage = String.format("Call to download document failed with response code: %d and message: %s",
                    response.code(), response.message());
            throw new IOException(errorMessage);
        }

        ResponseBody responseBody = response.body();
        if (responseBody == null) {
            throw new IOException("Received an empty response body");
        }

        // Get the charset from Content-Type
        MediaType mediaType = MediaType.parse(response.header("Content-Type"));
        Charset charset = mediaType != null ? mediaType.charset(StandardCharsets.UTF_8) : StandardCharsets.UTF_8;

        InputStream inputStream = responseBody.byteStream();
        if ("GZIP".equalsIgnoreCase(compressionAlgorithm)) {
            inputStream = new GZIPInputStream(inputStream);
        }

        return inputStream;  // Returning the InputStream for the downloaded document
    }

    /**
     * Uploads the provided byte array to the specified URL.
     *
     * @param source The byte array of the document to upload.
     * @param url The URL to upload the document to.
     * @throws IOException If there is an error during upload.
     */
    public static void upload(byte[] source, String url) throws IOException {
        String contentType = String.format("text/xml; charset=%s", StandardCharsets.UTF_8);
        Request request = new Request.Builder()
                .url(url)
                .put(RequestBody.create(MediaType.parse(contentType), source))
                .build();

        Response response = httpClient.newCall(request).execute();
        if (!response.isSuccessful()) {
            String errorMessage = String.format("Call to upload document failed with response code: %d and message: %s",
                    response.code(), response.message());
            throw new IOException(errorMessage);
        }
    }
}
