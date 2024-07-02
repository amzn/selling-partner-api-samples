import os
import uuid
import json
import boto3
import logging

from src.utils import constants

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"ProcessNotification Lambda started {event}")

    try:
        execution_arn = None
        # Iterate over SQS messages
        for message in event["Records"]:
            body_message = message["body"]
            logger.info(f"Received new notification: {body_message}")

            notification = json.loads(body_message)

            notification_type = notification[
                constants.NOTIFICATION_KEY_NOTIFICATION_TYPE
            ]

            # Only process the notification if it is of type 'DATA_KIOSK_QUERY_PROCESSING_FINISHED'
            if notification_type != constants.NOTIFICATION_TYPE_DK:
                logger.warning(f"Notification type {notification_type} skipped")
                continue

            dk_notification = notification["payload"]

            # Start a Step Functions workflow execution to retrieve query results from Data Kiosk
            execution_arn, message = start_step_functions_execution(dk_notification)
            logger.info(
                f"Notification Processing Message: {message}, Execution arn: {execution_arn}"
            )

        return "Finished processing incoming notifications"

    except json.JSONDecodeError as e:
        logger.error(
            f"Message body could not be mapped to an SP-API Notification: {e.__dict__}"
        )


# Extracts necessary data from notification.
def extract_info_from_notification(dk_notification):
    query_id = dk_notification[constants.NOTIFICATION_KEY_QUERY_ID]
    query = dk_notification[constants.NOTIFICATION_KEY_QUERY]
    processing_status = dk_notification[constants.NOTIFICATION_KEY_PROCESSING_STATUS]
    account_id = dk_notification[constants.NOTIFICATION_KEY_ACCOUNT_ID]
    return query_id, query, processing_status, account_id


# Determines the appropriate document ID based on processing status.
def determine_document_id(dk_notification, processing_status):
    notification_key = constants.NOTIFICATION_KEY_DATA_DOCUMENT_ID
    if processing_status == constants.NOTIFICATION_KEY_FATAL_PROCESSING:
        logger.info(
            f"Query Processing is {processing_status}. Check the Error Document for more info."
        )
        notification_key = constants.NOTIFICATION_KEY_ERROR_DOCUMENT_ID
    return dk_notification.get(notification_key, None)


# Constructs the input payload for the state machine.
def construct_input_payload(
    query_id, query, processing_status, account_id, document_id
):
    document = (
        {constants.STATE_MACHINE_KEY_DOCUMENT_ID: document_id} if document_id else {}
    )
    return {
        constants.STATE_MACHINE_KEY_QUERY_ID: query_id,
        constants.STATE_MACHINE_KEY_QUERY: query,
        constants.NOTIFICATION_KEY_PROCESSING_STATUS: processing_status,
        constants.STATE_MACHINE_KEY_DOCUMENT: document,
        constants.STATE_MACHINE_KEY_ACCOUNT_ID: account_id,
    }


# Start the Step Functions execution
def start_execution(state_machine_arn, account_id, query_id, input_payload):
    step_functions = boto3.client(constants.AWS_STEP_FUNCTIONS_CLIENT_NAME)
    execution_name = f"{account_id}-{query_id}-{str(uuid.uuid4())}"
    request = {
        "stateMachineArn": state_machine_arn,
        "name": execution_name,
        "input": json.dumps(input_payload),
    }
    result = step_functions.start_execution(**request)
    return result[constants.AWS_STEP_FUNCTIONS_EXECUTION_ARN_NAME]


# This function starts a Step Functions workflow execution.
def start_step_functions_execution(dk_notification):
    state_machine_arn = os.environ.get(constants.STATE_MACHINE_ARN_ENV_VARIABLE)
    query_id, query, processing_status, account_id = extract_info_from_notification(
        dk_notification
    )
    document_id = determine_document_id(dk_notification, processing_status)

    if (
        not document_id
        and processing_status == constants.NOTIFICATION_KEY_FATAL_PROCESSING
    ):
        return None, "Processing Done: Status - Fatal : No error document available"
    elif not document_id:
        return (
            None,
            "Processing Done: Status - Done : No data document available (Empty Data)",
        )

    input_payload = construct_input_payload(
        query_id, query, processing_status, account_id, document_id
    )
    execution_arn = start_execution(
        state_machine_arn, account_id, query_id, input_payload
    )
    return execution_arn, "State machine successfully started."
