import os
import uuid
import json
import boto3
import logging

from utils import constants

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"ProcessNotification Lambda started {event}")

    try:
        execution_arn = None
        # Iterate over SQS messages
        for message in event['Records']:

            body_message = message['body']
            logger.info(f"Received new notification: {body_message}")

            notification = json.loads(body_message)

            notification_type = notification[constants.NOTIFICATION_KEY_NOTIFICATION_TYPE]

            # Only process the notification if it is of type 'DATA_KIOSK_QUERY_PROCESSING_FINISHED'
            if notification_type != constants.NOTIFICATION_TYPE_DK:
                logger.warning(f"Notification type {notification_type} skipped")
                continue

            dk_notification = notification['payload']

            # Start a Step Functions workflow execution to retrieve query results from Data Kiosk
            execution_arn, message = start_step_functions_execution(dk_notification)
            logger.info(f"Notification Processing Message: {message}, Execution arn: {execution_arn}")

        return "Finished processing incoming notifications"

    except json.JSONDecodeError as e:
        logger.error(f"Message body could not be mapped to an SP-API Notification: {e.__dict__}")


# This function starts a Step Functions workflow execution.
def start_step_functions_execution(dk_notification):
    query_id = dk_notification[constants.NOTIFICATION_KEY_QUERY_ID]
    query = dk_notification[constants.NOTIFICATION_KEY_QUERY]
    processing_status = dk_notification[constants.NOTIFICATION_KEY_PROCESSING_STATUS]
    account_id = dk_notification[constants.NOTIFICATION_KEY_ACCOUNT_ID]
    state_machine_arn = os.environ.get(constants.STATE_MACHINE_ARN_ENV_VARIABLE)
    data_document_id = dk_notification.get(constants.NOTIFICATION_KEY_DATA_DOCUMENT_ID, None)

    if processing_status == constants.NOTIFICATION_KEY_FATAL_PROCESSING:
        logger.info(f"Query Processing is {processing_status}. Check the Error Document for more info. "
                    f"Change the query and submit again.")

        # Setting document_id to parse errorDocumentId instead of dataDocumentId since the processing is not DONE
        if dk_notification[constants.NOTIFICATION_KEY_ERROR_DOCUMENT_ID]:
            document_id = dk_notification[constants.NOTIFICATION_KEY_ERROR_DOCUMENT_ID]
        else:
            message = "Processing Done: Status - Fatal : No error document"
            return None, message
    elif data_document_id:
        document_id = dk_notification[constants.NOTIFICATION_KEY_DATA_DOCUMENT_ID]
    else:
        message = "Processing Done: Status - Done : No data document available (Empty Data)"
        return None, message

    input_payload = {
        constants.STATE_MACHINE_KEY_QUERY_ID: query_id,
        constants.STATE_MACHINE_KEY_QUERY: query,
        constants.NOTIFICATION_KEY_PROCESSING_STATUS: processing_status,
        constants.STATE_MACHINE_KEY_DOCUMENT: {
            constants.STATE_MACHINE_KEY_DOCUMENT_ID: document_id
        },
        constants.STATE_MACHINE_KEY_ACCOUNT_ID: account_id
    }

    request = {
        'stateMachineArn': state_machine_arn,
        'name': f"{account_id}-{query_id}-{str(uuid.uuid4())}",
        'input': json.dumps(input_payload)
    }

    step_functions = boto3.client(constants.AWS_STEP_FUNCTIONS_CLIENT_NAME)
    result = step_functions.start_execution(**request)

    return result[constants.AWS_STEP_FUNCTIONS_EXECUTION_ARN_NAME], "State machine successfully started. "
