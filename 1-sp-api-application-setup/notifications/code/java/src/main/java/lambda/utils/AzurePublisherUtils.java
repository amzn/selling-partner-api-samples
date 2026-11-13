package lambda.utils;


import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.azure.messaging.servicebus.ServiceBusClientBuilder;
import com.azure.messaging.servicebus.ServiceBusMessage;
import com.azure.messaging.servicebus.ServiceBusSenderClient;
import com.azure.storage.queue.QueueClient;
import com.azure.storage.queue.QueueClientBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static lambda.common.Constants.*;
import static lambda.utils.SecretManagerUtils.getSecretString;

public class AzurePublisherUtils {

    /**
     * Sends a message to an Azure Storage Queue.
     * <p>
     * This method retrieves the Azure Storage connection string from AWS Secrets Manager
     * using the environment variable {@code AZURE_QUEUE_CONNECTION_STRING_ARN_ENV_VARIABLE},
     * and the target queue name from {@code AZURE_QUEUE_NAME_ENV_VARIABLE}. It then sends
     * the provided message to the specified queue using the Azure SDK's {@link QueueClient}.
     *
     * @param messageBody The message body to send to the Azure Storage Queue.
     * @param logger      The AWS Lambda logger used for diagnostic output.
     * @throws RuntimeException if the connection string is not found or message sending fails.
     */
    public static void sendToAzureStorageQueue(String messageBody, LambdaLogger logger) {
        logger.log("Staring sendToAzureStorageQueue......");
        String connStrArn = System.getenv(AZURE_QUEUE_CONNECTION_STRING_ARN_ENV_VARIABLE);
        String queueName = System.getenv(AZURE_QUEUE_NAME_ENV_VARIABLE);

        // Load Connection String from Secrets Manager
        String connStr = getSecretString(connStrArn);
        if (connStr == null || connStr.isEmpty()) {
            logger.log("Failed to load SAzure Storage connection string.");
            throw new RuntimeException("Azure Storage connection string not found");
        }
        logger.log("Loaded Azure Storage connection string from Secrets Manager");

        QueueClient queueClient = new QueueClientBuilder()
                .connectionString(connStr)
                .queueName(queueName)
                .buildClient();

        logger.log("Sending message to Azure Storage queue");
        queueClient.sendMessage(messageBody);
        logger.log("Message sent to Azure Storage Queue: " + queueName);
    }

    /**
     * Sends a message to an Azure Service Bus Queue.
     * <p>
     * This method retrieves the Azure Service Bus connection string from AWS Secrets Manager
     * using the environment variable {@code AZURE_SB_CONNECTION_STRING_ARN_ENV_VARIABLE},
     * and the target queue name from {@code AZURE_SB_QUEUE_NAME_ENV_VARIABLE}. It then sends
     * the provided message to the queue using the Azure SDK's {@link ServiceBusSenderClient}.
     * <p>
     * The method ensures proper client closure and logs diagnostic details.
     *
     * @param messageBody The message body to send to Azure Service Bus.
     * @param logger      The AWS Lambda logger used for diagnostic output.
     * @throws RuntimeException if the connection string is not found or sending fails.
     */
    public static void sendToAzureServiceBus(String messageBody, LambdaLogger logger) {
        logger.log("Staring sendToAzureServiceBus......");
        String connStrArn = System.getenv(AZURE_SB_CONNECTION_STRING_ARN_ENV_VARIABLE);
        String queueName = System.getenv(AZURE_SB_QUEUE_NAME_ENV_VARIABLE);

        // Load Connection String from Secrets Manager
        String connStr = getSecretString(connStrArn);
        if (connStr == null || connStr.isEmpty()) {
            logger.log("Failed to load Service Bus connection string.");
            throw new RuntimeException("Azure Service Bus connection string not found");
        }
        logger.log("Loaded Azure Service Bus connection string from Secrets Manager");

        // Create and send message
        try (ServiceBusSenderClient sender = new ServiceBusClientBuilder()
                .connectionString(connStr)
                .sender()
                .queueName(queueName)
                .buildClient()) {
            logger.log("Sending message to Azure Service Bus Queue");
            sender.sendMessage(new ServiceBusMessage(messageBody));
            logger.log("📨 Message sent to Azure Service Bus Queue: " + queueName);
        } catch (Exception e) {
            logger.log("❌ Failed to send message to Azure Service Bus: " + e.getMessage());
            throw e;
        }
    }
}
