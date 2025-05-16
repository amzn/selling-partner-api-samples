package lambda.process.internal;

import com.amazonaws.services.lambda.runtime.Context;
import com.amazonaws.services.lambda.runtime.LambdaLogger;
import com.amazonaws.services.lambda.runtime.RequestHandler;
import com.amazonaws.services.lambda.runtime.events.SQSBatchResponse;
import com.amazonaws.services.lambda.runtime.events.SQSEvent;

import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

public class SQSNotificationsHandler implements RequestHandler<SQSEvent, SQSBatchResponse> {


    public SQSBatchResponse handleRequest(SQSEvent input, Context context) {
        LambdaLogger logger = context.getLogger();
        List<SQSBatchResponse.BatchItemFailure> batchItemFailures = new ArrayList<>();

        logger.log("ProcessNotification Lambda initiated: " +
                ZonedDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));

        for (SQSEvent.SQSMessage message : input.getRecords()) {
            logger.log("Notification: " + message.getBody());
        }
        logger.log("ProcessNotification Lambda completed successfully. Total messages: " +
                input.getRecords().size() + ", Failures: " + 0);

        return new SQSBatchResponse(batchItemFailures);
    }
}