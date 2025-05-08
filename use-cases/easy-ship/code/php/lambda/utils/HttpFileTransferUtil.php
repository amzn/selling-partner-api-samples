<?php

namespace Lambda\Utils;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Exception\RequestException;
use GuzzleHttp\Psr7\Stream;
use RuntimeException;

class HttpFileTransferUtil
{
    private static ?Client $httpClient = null;

    /**
     * Initializes the HTTP client.
     */
    private static function getHttpClient(): Client
    {
        if (self::$httpClient === null) {
            self::$httpClient = new Client([
                'timeout' => 30.0, // Set a timeout for HTTP requests
            ]);
        }
        return self::$httpClient;
    }

    /**
     * Downloads a document from the specified URL and returns it as a stream.
     *
     * @param string $url The URL to download the document from.
     * @param string|null $compressionAlgorithm The compression algorithm to use (e.g., "GZIP").
     * @return \Psr\Http\Message\StreamInterface The downloaded document as a stream.
     * @throws RuntimeException|GuzzleException If the download fails or the response is invalid.
     */
    public static function download(
        string $url,
        ?string $compressionAlgorithm = null
    ): \Psr\Http\Message\StreamInterface {
        try {
            $response = self::getHttpClient()->get($url);

            if ($response->getStatusCode() !== 200) {
                throw new RuntimeException(sprintf(
                    'Call to download document failed with response code: %d and message: %s',
                    $response->getStatusCode(),
                    $response->getReasonPhrase()
                ));
            }

            $stream = $response->getBody();

            // Handle GZIP compression if specified
            if (strtolower($compressionAlgorithm) === 'gzip') {
                $gzippedData = $stream->getContents();
                $uncompressedData = gzdecode($gzippedData);
                if ($uncompressedData === false) {
                    throw new RuntimeException('Failed to decode GZIP compressed data.');
                }
                return \GuzzleHttp\Psr7\Utils::streamFor($uncompressedData);
            }

            return $stream;
        } catch (RequestException $e) {
            throw new RuntimeException('Error during document download: ' . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Uploads the provided byte array to the specified URL.
     *
     * @param string $data The content of the document to upload.
     * @param string $url The URL to upload the document to.
     * @throws RuntimeException|GuzzleException If the upload fails.
     */
    public static function upload(string $data, string $url): void
    {
        try {
            $response = self::getHttpClient()->put($url, [
                'body' => $data,
                'headers' => [
                    'Content-Type' => 'text/xml; charset=UTF-8',
                ],
            ]);

            if ($response->getStatusCode() !== 200) {
                throw new RuntimeException(sprintf(
                    'Call to upload document failed with response code: %d and message: %s',
                    $response->getStatusCode(),
                    $response->getReasonPhrase()
                ));
            }
        } catch (RequestException $e) {
            throw new RuntimeException('Error during document upload: ' . $e->getMessage(), 0, $e);
        }
    }
}
