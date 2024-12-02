package lambda.utils;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.InputStream;
import java.io.StringWriter;

public class XmlUtil {

    /**
     * Extracts the text content of a specified XML tag from an InputStream.
     *
     * @param inputStream The InputStream containing the XML data.
     * @param targetTagName The name of the XML tag to retrieve the content from.
     * @return The text content of the specified tag.
     * @throws Exception If the specified tag is not found or if an error occurs during parsing.
     */
    public static String getXmlDocumentTag(InputStream inputStream, String targetTagName) throws Exception {
        // Initialize the DocumentBuilder
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        DocumentBuilder builder = factory.newDocumentBuilder();

        // Parse the XML InputStream
        Document document = builder.parse(inputStream);

        // Get the target element by its tag name
        NodeList nodeList = document.getElementsByTagName(targetTagName);
        if (nodeList.getLength() > 0) {
            Element element = (Element) nodeList.item(0);
            // Extract and return the text content of the element
            return element.getTextContent();
        }

        // Throw an exception if the target element is not found
        throw new Exception(String.format("Element '%s' not found in XML.", targetTagName));
    }

    /**
     * Generates an AmazonEnvelope XML string for EasyShip with specified merchant identifier, order ID, and document type.
     *
     * @param merchantIdentifier The Merchant Identifier to include in the envelope.
     * @param amazonOrderID The Amazon Order ID to include in the EasyShipDocument.
     * @param documentType The document type (e.g., "ShippingLabel") to include in the EasyShipDocument.
     * @return A formatted XML string representing the AmazonEnvelope structure.
     * @throws ParserConfigurationException If there is a serious configuration error.
     * @throws TransformerException If an error occurs during the XML transformation.
     */
    public static String generateEasyShipAmazonEnvelope(String merchantIdentifier, String amazonOrderID, String documentType)
            throws ParserConfigurationException, TransformerException {

        // Initialize the XML Document Builder
        DocumentBuilderFactory docFactory = DocumentBuilderFactory.newInstance();
        DocumentBuilder docBuilder = docFactory.newDocumentBuilder();

        // Root element: AmazonEnvelope
        Document doc = docBuilder.newDocument();
        Element rootElement = doc.createElement("AmazonEnvelope");
        rootElement.setAttribute("xmlns:xsi", "http://www.w3.org/2001/XMLSchema-instance");
        rootElement.setAttribute("xsi:noNamespaceSchemaLocation", "amzn-envelope.xsd");
        doc.appendChild(rootElement);

        // Header element
        Element header = doc.createElement("Header");
        rootElement.appendChild(header);

        // DocumentVersion element within Header
        Element documentVersion = doc.createElement("DocumentVersion");
        documentVersion.appendChild(doc.createTextNode("1.01"));
        header.appendChild(documentVersion);

        // MerchantIdentifier element within Header
        Element merchantId = doc.createElement("MerchantIdentifier");
        merchantId.appendChild(doc.createTextNode(merchantIdentifier));
        header.appendChild(merchantId);

        // MessageType element
        Element messageType = doc.createElement("MessageType");
        messageType.appendChild(doc.createTextNode("EasyShipDocument"));
        rootElement.appendChild(messageType);

        // Message element
        Element message = doc.createElement("Message");
        rootElement.appendChild(message);

        // MessageID element within Message
        Element messageID = doc.createElement("MessageID");
        messageID.appendChild(doc.createTextNode("1"));
        message.appendChild(messageID);

        // EasyShipDocument element within Message
        Element easyShipDocument = doc.createElement("EasyShipDocument");
        message.appendChild(easyShipDocument);

        // AmazonOrderID element within EasyShipDocument
        Element amazonOrder = doc.createElement("AmazonOrderID");
        amazonOrder.appendChild(doc.createTextNode(amazonOrderID));
        easyShipDocument.appendChild(amazonOrder);

        // DocumentType element within EasyShipDocument
        Element docType = doc.createElement("DocumentType");
        docType.appendChild(doc.createTextNode(documentType));
        easyShipDocument.appendChild(docType);

        // Transform document to a String
        TransformerFactory transformerFactory = TransformerFactory.newInstance();
        Transformer transformer = transformerFactory.newTransformer();
        transformer.setOutputProperty(OutputKeys.INDENT, "yes");
        transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "no");
        transformer.setOutputProperty(OutputKeys.ENCODING, "UTF-8");

        StringWriter writer = new StringWriter();
        transformer.transform(new DOMSource(doc), new StreamResult(writer));

        return writer.getBuffer().toString();
    }
}
