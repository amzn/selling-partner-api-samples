package lambda;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.gson.Gson;
import lambda.utils.Document;
import lambda.utils.NotificationPayload;
import lambda.utils.SPAPINotification;
import lambda.utils.StateMachineInput;
import lambda.utils.StateMachineNotStartedException;
import software.amazon.awssdk.services.sfn.SfnClient;
import software.amazon.awssdk.services.sfn.model.StartExecutionRequest;
import software.amazon.awssdk.services.sfn.model.StartExecutionResponse;

import java.io.IOException;
import java.util.UUID;

import static lambda.utils.Constants.DATA_KIOSK_NOTIFICATION_PROCESSING_STATUS_FATAL;
import static lambda.utils.Constants.NOTIFICATION_TYPE_DATA_KIOSK_PROCESSING_FINISHED;
import static lambda.utils.Constants.STATE_MACHINE_ARN_ENV_VARIABLE;

public class ProcessNotificationHandler implements RequestHandler<SQSEvent, String> {

    public String handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        logger.log("ProcessNotification Lambda input: " + new Gson().toJson(input));

        // Iterate over SQS messages
        // Start a Step Functions workflow execution for every Data Kiosk Processing Finished notifications
        for (SQSEvent.SQSMessage message : input.getRecords()) {
            logger.log(String.format("Notification body: %s", message.getBody()));

            try {
                SPAPINotification notification = mapNotification(message.getBody());

                // Only process the notification if it is of type 'DATA_KIOSK_QUERY_PROCESSING_FINISHED'
                if (!NOTIFICATION_TYPE_DATA_KIOSK_PROCESSING_FINISHED.equals(notification.getNotificationType())) {
                    logger.log(String.format("Notification type %s skipped", notification.getNotificationType()));
                    continue;
                }

                // Start a Step Functions workflow execution to retrieve query results from Data Kiosk
                logger.log("Starting state machine execution");
                String executionArn = startStepFunctionsExecution(notification.getPayload(), logger);
                logger.log(String.format("State machine successfully started. Execution arn: %s", executionArn));
            } catch (StateMachineNotStartedException e) {
                logger.log(String.format("State machine not started. %s", e.getMessage()));
            } catch (Exception e) {
                throw new InternalError("ProcessNotification Lambda failed", e);
            }
        }

        return "Finished processing incoming notifications";
    }

    private SPAPINotification mapNotification(String notificationBody) throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        SPAPINotification notification = mapper.readValue(notificationBody, SPAPINotification.class);

        return notification;
    }

    private String startStepFunctionsExecution(NotificationPayload dataKioskNotification, LambdaLogger logger)
            throws JsonProcessingException, StateMachineNotStartedException {

        String documentId = "";

        if (DATA_KIOSK_NOTIFICATION_PROCESSING_STATUS_FATAL.equals(dataKioskNotification.getProcessingStatus())) {
            logger.log("Query Processing is FATAL. Check the Error Document for more info. Change the query and submit again.");

            //Setting documentId to parse errorDocumentId instead of dataDocumentId since the processing is not DONE
            if (dataKioskNotification.getErrorDocumentId() == null) {
                throw new StateMachineNotStartedException("Processing Done: Status - FATAL : No error document");
            }

            documentId = dataKioskNotification.getErrorDocumentId();
        } else if (dataKioskNotification.getDataDocumentId() == null) {
            throw new StateMachineNotStartedException("Processing Done: Status - Done : No data document available (Empty Data)");
        } else {
            documentId = dataKioskNotification.getDataDocumentId();
        }

        ObjectMapper mapper = new ObjectMapper();
        StateMachineInput input = getStateMachineInput(dataKioskNotification, documentId);
        String inputStr = mapper.writeValueAsString(input);

        StartExecutionRequest request = StartExecutionRequest.builder()
                .stateMachineArn(System.getenv(STATE_MACHINE_ARN_ENV_VARIABLE))
                .name(String.format("%s-%s-%s",
                        dataKioskNotification.getAccountId(),
                        dataKioskNotification.getQueryId(),
                        UUID.randomUUID()))
                .input(inputStr)
                .build();

        SfnClient stepFunctions = SfnClient.builder().build();
        StartExecutionResponse result = stepFunctions.startExecution(request);

        return result.executionArn();
    }

    private StateMachineInput getStateMachineInput(NotificationPayload dataKioskNotification, String documentId) {
        return  StateMachineInput.builder()
                .accountId(dataKioskNotification.getAccountId())
                .queryId(dataKioskNotification.getQueryId())
                .query(dataKioskNotification.getQuery())
                .document(Document.builder().documentId(documentId).build())
                .processingStatus(dataKioskNotification.getProcessingStatus())
                .build();
    }
}
