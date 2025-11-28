<?php

namespace Src\messaging;

use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use SpApi\Api\messaging\v1\MessagingApi;
use SpApi\Api\uploads\v2020_11_01\UploadsApi;
use SpApi\Model\messaging\v1\Attachment;
use SpApi\Model\messaging\v1\InvoiceRequest;
use Src\util\Recipe;

class SendInvoiceToBuyerRecipe extends Recipe
{
    private MessagingApi $messagingApi;
    private UploadsApi $uploadsApi;
    private string $amazonOrderId;
    private array $marketplaceIds;
    private string $invoiceFilePath;
    private string $contentType;

    public function start(): void
    {
        $this->setupOrderDetails();
        $this->initializeMessagingApi();
        $actions = $this->getAvailableMessageTypes();
        $canSendInvoice = $this->checkCanSendInvoice($actions);
        
        if ($canSendInvoice) {
            echo "✅ You can send an invoice for this order\n";
            $this->initializeUploadsApi();
            $md5 = $this->calculateMd5();
            $response = $this->createUploadDestination($md5);
            echo "✅ Invoice uploaded\n";
            $this->sendInvoiceMessage($response->getPayload()->getUploadDestinationId(), $this->amazonOrderId, "Invoice.pdf");
        } else {
            echo "❌ You cannot send an invoice for this order\n";
        }
    }

    private function checkCanSendInvoice($actions): bool
    {
        foreach ($actions->getLinks()->getActions() as $link) {
            if (str_contains($link->getName(), 'sendInvoice')) {
                return true;
            }
        }
        return false;
    }

    private function initializeMessagingApi(): void
    {
        $this->messagingApi = new MessagingApi($this->config);
        echo "Messaging API client initialized\n";
    }

    private function setupOrderDetails(): void
    {
        $this->amazonOrderId = "701-2312323-4427400";
        $this->marketplaceIds = ["A2Q3Y263D00KWC"];
        $this->invoiceFilePath = "resources/invoice.pdf";
        $this->contentType = "application/pdf";
        echo "Order details configured: {$this->amazonOrderId}\n";
    }

    private function getAvailableMessageTypes()
    {
        return $this->messagingApi->getMessagingActionsForOrder($this->amazonOrderId, $this->marketplaceIds);
    }

    private function initializeUploadsApi(): void
    {
        $this->uploadsApi = new UploadsApi($this->config);
        echo "Uploads API client initialized\n";
    }

    private function calculateMd5(): string
    {
        $fileContent = file_get_contents($this->invoiceFilePath);
        return base64_encode(md5($fileContent, true));
    }

    private function createUploadDestination(string $md5)
    {
        $resource = "messaging/v1/orders/{$this->amazonOrderId}/messages/invoice";
        return $this->uploadsApi->createUploadDestinationForResource($this->marketplaceIds, $md5, $resource, $this->contentType);
    }

    private function uploadInvoice(string $uploadDestinationUrl, string $invoiceFilePath, string $contentMd5): bool
    {
        $fileBytes = file_get_contents($invoiceFilePath);
        $client = new Client(['verify' => false]);
        $request = new Request(
            'PUT',
            $uploadDestinationUrl,
            [
                'Content-Type' => $this->contentType,
                'Content-MD5' => $contentMd5
            ],
            $fileBytes
        );

        $response = $client->send($request);
        $statusCode = $response->getStatusCode();
        return $statusCode >= 200 && $statusCode < 300;
    }

    private function sendInvoiceMessage(string $uploadDestinationId, string $orderId, string $fileName): void
    {
        $attachment = new Attachment();
        $attachment->setFileName($fileName);
        $attachment->setUploadDestinationId($uploadDestinationId);
        
        $body = new InvoiceRequest();
        $body->setAttachments([$attachment]);
        
        $this->messagingApi->sendInvoice($orderId, $this->marketplaceIds, $body);
        echo "✅ Invoice message sent successfully\n";
    }
}
