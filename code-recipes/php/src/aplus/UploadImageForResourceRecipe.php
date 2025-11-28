<?php

namespace Src\aplus;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use SpApi\Api\uploads\v2020_11_01\UploadsApi;
use Src\util\Recipe;
use Src\util\Constants;

class UploadImageForResourceRecipe extends Recipe
{
    private UploadsApi $uploadsApi;
    private array $marketplaceIds;
    private string $imageFilePath;
    private string $contentType;

    public function start(): void
    {
        $this->setupImageDetails();
        $this->initializeUploadsApi();
        $md5 = $this->calculateMd5();
        $response = $this->createUploadDestination($md5);
        $uploaded = $this->uploadImage($response['payload']['url']);
        
        if ($uploaded) {
            echo "✅ Image uploaded successfully\n";
            echo "Upload Destination ID: " . $response->getPayload()->getUploadDestinationId() . "\n";
        } else {
            echo "❌ Failed to upload image\n";
        }
    }

    private function setupImageDetails(): void
    {
        $this->marketplaceIds = ["A2Q3Y263D00KWC"];
        $this->imageFilePath = "resources/test_image.jpg";
        $this->contentType = "image/jpeg";
        echo "Image details configured: {$this->imageFilePath}\n";
    }

    private function initializeUploadsApi(): void
    {
        $this->uploadsApi = new UploadsApi($this->config);
        echo "Uploads API client initialized\n";
    }

    private function calculateMd5(): string
    {
        $fileContent = file_get_contents($this->imageFilePath);
        $md5 = base64_encode(md5($fileContent, true));
        echo "MD5: {$md5}\n";
        return $md5;
    }

    private function createUploadDestination(string $md5)
    {
        $resource = "aplus/2020-11-01/contentDocuments";
        $response = $this->uploadsApi->createUploadDestinationForResource($this->marketplaceIds, $md5, $resource, $this->contentType);
        echo "Upload URL: " . $response->getPayload()->getUrl() . "\n";
        return $response;
    }

    private function uploadImage(string $uploadDestinationUrl): bool
    {
        $fileBytes = file_get_contents($this->imageFilePath);
        $boundary = "----WebKitFormBoundary" . time();
        
        $requestBody = $this->buildMultipartBody($uploadDestinationUrl, $fileBytes, $this->contentType, $boundary);
        $baseUrl = explode('?', $uploadDestinationUrl)[0];

        $client = new Client(['verify' => false]);
        $request = new Request(
            'POST',
            $baseUrl,
            ['Content-Type' => "multipart/form-data; boundary={$boundary}"],
            $requestBody
        );

        $response = $client->send($request);
        $statusCode = $response->getStatusCode();
        echo "Upload response code: {$statusCode}\n";
        return $statusCode >= 200 && $statusCode < 300;
    }

    private function buildMultipartBody(string $url, string $fileBytes, string $contentType, string $boundary): string
    {
        $output = '';
        $queryParams = $this->extractQueryParameters($url);
        
        foreach ($queryParams as $key => $value) {
            $output .= "--{$boundary}\r\n";
            $output .= "Content-Disposition: form-data; name=\"{$key}\"\r\n\r\n";
            $output .= "{$value}\r\n";
        }
        
        $output .= "--{$boundary}\r\n";
        $output .= "Content-Disposition: form-data; name=\"File\"; filename=\"test_image.jpg\"\r\n";
        $output .= "Content-Type: {$contentType}\r\n\r\n";
        $output .= $fileBytes;
        $output .= "\r\n--{$boundary}--\r\n";
        
        return $output;
    }

    private function extractQueryParameters(string $urlString): array
    {
        $parsedUrl = parse_url($urlString);
        if (!isset($parsedUrl['query'])) {
            return [];
        }
        
        parse_str($parsedUrl['query'], $params);
        return $params;
    }
}
