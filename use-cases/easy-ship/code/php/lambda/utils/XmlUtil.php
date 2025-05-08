<?php

namespace Lambda\Utils;

use DOMDocument;
use RuntimeException;

class XmlUtil
{
    /**
     * Extracts the text content of a specified XML tag from an InputStream.
     *
     * @param string $xmlContent The XML string to parse.
     * @param string $targetTagName The name of the XML tag to retrieve the content from.
     * @return string The text content of the specified tag.
     * @throws RuntimeException If the specified tag is not found or if an error occurs during parsing.
     */
    public static function getXmlDocumentTag(string $xmlContent, string $targetTagName): string
    {
        $doc = new DOMDocument();

        // Load the XML content
        if (!$doc->loadXML($xmlContent)) {
            throw new RuntimeException('Failed to parse XML content.');
        }

        // Get elements by tag name
        $elements = $doc->getElementsByTagName($targetTagName);
        if ($elements->length > 0) {
            return $elements->item(0)->textContent;
        }

        throw new RuntimeException(sprintf("Element '%s' not found in XML.", $targetTagName));
    }

    /**
     * Generates an AmazonEnvelope XML string for EasyShip
     * with specified merchant identifier, order ID, and document type.
     *
     * @param string $merchantIdentifier The Merchant Identifier to include in the envelope.
     * @param string $amazonOrderID The Amazon Order ID to include in the EasyShipDocument.
     * @param string $documentType The document type (e.g., "ShippingLabel") to include in the EasyShipDocument.
     * @return string A formatted XML string representing the AmazonEnvelope structure.
     * @throws RuntimeException If an error occurs during XML generation.
     * @throws \DOMException
     */
    public static function generateEasyShipAmazonEnvelope(
        string $merchantIdentifier,
        string $amazonOrderID,
        string $documentType
    ): string {
        $doc = new DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = true;

        // Root element: AmazonEnvelope
        $root = $doc->createElement('AmazonEnvelope');
        $root->setAttribute('xmlns:xsi', 'http://www.w3.org/2001/XMLSchema-instance');
        $root->setAttribute('xsi:noNamespaceSchemaLocation', 'amzn-envelope.xsd');
        $doc->appendChild($root);

        // Header element
        $header = $doc->createElement('Header');
        $root->appendChild($header);

        // DocumentVersion element within Header
        $documentVersion = $doc->createElement('DocumentVersion', '1.01');
        $header->appendChild($documentVersion);

        // MerchantIdentifier element within Header
        $merchantId = $doc->createElement('MerchantIdentifier', $merchantIdentifier);
        $header->appendChild($merchantId);

        // MessageType element
        $messageType = $doc->createElement('MessageType', 'EasyShipDocument');
        $root->appendChild($messageType);

        // Message element
        $message = $doc->createElement('Message');
        $root->appendChild($message);

        // MessageID element within Message
        $messageID = $doc->createElement('MessageID', '1');
        $message->appendChild($messageID);

        // EasyShipDocument element within Message
        $easyShipDocument = $doc->createElement('EasyShipDocument');
        $message->appendChild($easyShipDocument);

        // AmazonOrderID element within EasyShipDocument
        $amazonOrder = $doc->createElement('AmazonOrderID', $amazonOrderID);
        $easyShipDocument->appendChild($amazonOrder);

        // DocumentType element within EasyShipDocument
        $docType = $doc->createElement('DocumentType', $documentType);
        $easyShipDocument->appendChild($docType);

        // Transform the DOMDocument to a string
        return $doc->saveXML();
    }
}
