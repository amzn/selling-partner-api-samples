import os
import uuid
import json
import boto3
import logging

from src.utils import constants

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"ProcessNotification Lambda input: {event}")
    
    # Iterate over SQS messages
    # Start a Step Functions workflow execution for unprocessed MFN orders
    for message in event[constants.NOTIFICATION_MESSAGE_KEY_NAME]:
        body_message = message[constants.NOTIFICATION_BODY_KEY_NAME]
        logger.info(f"Received new notification: {body_message}")

        try:
            notification = json.loads(body_message)
            if notification[constants.NOTIFICATION_TYPE_KEY_NAME] != constants.NOTIFICATION_TYPE_ORDER_CHANGE:
                logger.warning(f"Notification type {notification[constants.NOTIFICATION_TYPE_KEY_NAME]} skipped")
                continue

            order_notification = notification[constants.NOTIFICATION_PAYLOAD_KEY_NAME][constants.NOTIFICATION_NAME_KEY_NAME]
            if order_notification[constants.NOTIFICATION_LEVEL_KEY_NAME] != constants.NOTIFICATION_LEVEL_ORDER_LEVEL:
                logger.warning(f"Notification level {order_notification[constants.NOTIFICATION_LEVEL_KEY_NAME]} skipped")
                continue

            order_summary = order_notification[constants.NOTIFICATION_SUMMARY_KEY_NAME]

            # If the order is MFN and has not been processed, start a workflow execution
            if order_summary[constants.NOTIFICATION_FFM_TYPE_KEY_NAME] == constants.SHIPPING_FULFILLMENT_CODE and order_summary[constants.NOTIFICATION_ORDER_STATUS_KEY_NAME] in constants.NOTIFICATION_PROCESSING_STATUS_ALL:
                logger.info("Starting state machine execution")
                execution_arn = start_step_functions_execution(order_notification)
                logger.info(f"State machine successfully started. Execution arn: {execution_arn}")
            else:
                logger.warning(f"Order channel {order_summary[constants.NOTIFICATION_FFM_TYPE_KEY_NAME]} and status {order_summary[constants.NOTIFICATION_ORDER_STATUS_KEY_NAME]} skipped")
        except json.JSONDecodeError as e:
            logger.error(f"Message body could not be mapped to a SP-API Notification: {e}")

    return "Finished processing incoming notifications"


def start_step_functions_execution(order_notification):
    request = {
        'stateMachineArn': os.environ.get(constants.STATE_MACHINE_ARN_ENV_VARIABLE),
        'name': f"{order_notification[constants.NOTIFICATION_AMZ_ORDER_ID_KEY_NAME]}-{str(uuid.uuid4())}",
        'input': json.dumps({
            constants.STATE_MACHINE_KEY_CREDENTIALS: {
                constants.STATE_MACHINE_ORDER_ID_KEY_NAME: order_notification[constants.NOTIFICATION_AMZ_ORDER_ID_KEY_NAME],
                constants.STATE_MACHINE_ONE_CLICK_SHIPMENT_KEY_NAME: os.environ.get(constants.ONE_CLICK_SHIPMENT_ENV_VARIABLE)
            }
        })
    }

    step_functions = boto3.client(constants.AWS_STEP_FUNCTIONS_CLIENT_KEY_NAME)
    result = step_functions.start_execution(**request)

    return result[constants.AWS_STEP_FUNCTIONS_ARN_KEY_NAME]