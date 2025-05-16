package lambda.utils;


import com.amazonaws.services.lambda.runtime.LambdaLogger;
import lambda.common.NotificationDestinationType;

public class CrossPlatformUtils {

    /**
     * Publishes a message to the specified cross-platform destination, such as AWS SQS, EventBridge,
     * GCP Pub/Sub, or Azure messaging services, based on the provided {@code destinationType}.
     *
     * This method acts as a unified dispatcher that routes the message to the appropriate
     * cloud-specific publishing utility depending on the destination type.
     *
     * Supported destinations:
     * - {@code AWS_SQS}: Sends the message to Amazon SQS.
     * - {@code AWS_EVENTBRIDGE}: Sends the message to Amazon EventBridge.
     * - {@code GCP_PUBSUB}: Publishes the message to Google Cloud Pub/Sub.
     * - {@code AZURE_STORAGE_QUEUE}: Sends the message to Azure Storage Queue.
     * - {@code AZURE_SERVICE_BUS}: Sends the message to Azure Service Bus.
     *
     * If the destination type is not supported, the method logs a warning.
     *
     * @param logger The Lambda logger for logging messages and errors
     * @param destinationType The destination type enum indicating where the message should be published
     * @param message The message body to publish (typically a JSON string)
     * @throws Exception If any of the publishing methods throw an exception
     */
    public static void publishCrossPlatform(LambdaLogger logger, NotificationDestinationType destinationType, String message) throws Exception {
        switch (destinationType) {
            case AWS_SQS:
                AwsPublisherUtils.sendToSQS(message, logger);
                break;
            case AWS_EVENTBRIDGE:
                AwsPublisherUtils.sendToEventBridge(message, logger);
                break;
            case GCP_PUBSUB:
                GcpPublisherUtils.publishToGCPPubSub(message, logger);
                break;
            case AZURE_STORAGE_QUEUE:
                AzurePublisherUtils.sendToAzureStorageQueue(message, logger);
                break;
            case AZURE_SERVICE_BUS:
                AzurePublisherUtils.sendToAzureServiceBus(message, logger);
                break;
            default:
                logger.log("Unsupported destination type.");
        }

        logger.log("Message forwarded successfully.");
    }
}
