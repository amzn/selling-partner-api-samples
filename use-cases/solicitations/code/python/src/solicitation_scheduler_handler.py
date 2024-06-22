from constants import Constants

import os
import json
import boto3
import logging

from datetime import datetime, timedelta

scheduler = boto3.client('scheduler')

'''
# Sample event input
{
    "Records": [
        "body": {
            "NotificationType": "ORDER_CHANGE",
            "Payload": {
                "OrderChangeNotification": {
                    "SellerId": "A3TH9S8BH6GOGM",
                    "AmazonOrderId": "123-1234567-1234567",
                    "Summary": {
                        "MarketplaceId": "ATVPDKIKX0DER",
                        "OrderStatus": "Shipped",
                        "EarliestDeliveryDate": "2023-10-10T13:30:00.000Z",
                        "LatestDeliveryDate": "2023-10-20T13:30:00.000Z"
                    }
                }
            },
            "Sandbox": "Yes"
        }
    ]
}
'''

def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info('Solicitation Scheduler handler started')
    logger.info(event)

    # Process all notifications received
    for record in event.get('Records'):
        body = record.get('body')
        json_body = json.loads(body)

        # If it is not `ORDER_CHANGE` notification, skip it
        notification_type = json_body.get('NotificationType')
        if (notification_type != Constants.NOTIFICATION_TYPE_ORDER_CHANGE):
            logger.info(f'Notification type {notification_type} skipped')
            continue

        order_change_notification = json_body.get('Payload').get('OrderChangeNotification')

        # If the order status is not 'Shipped', skip the notification
        order_status = order_change_notification.get('Summary').get('OrderStatus')
        if (order_status != Constants.ORDER_CHANGE_NOTIFICATION_STATUS_SHIPPED):
            logger.info(f'Notification status {order_status} skipped')
            continue

        # Read the order details from the notification
        seller_id = order_change_notification.get('SellerId')
        order_id = order_change_notification.get('AmazonOrderId')
        marketplace_id = order_change_notification.get('Summary').get('MarketplaceId')
        order_earliest_delivery_date = order_change_notification.get('Summary').get('EarliestDeliveryDate')
        order_latest_delivery_date = order_change_notification.get('Summary').get('LatestDeliveryDate')

        # Create an EventBridge schedule to automatically start the solicitation workflow on `EarliestDeliveryDate + 5 days`
        schedule_name = f'solicitations-{seller_id}-{order_id}'
        # If a schedule for the order already exists, skip the creation of a new schedule
        try:
            scheduler.get_schedule(Name=schedule_name)
            logger.info(f'Schedule with name = {schedule_name} already exists. Skipping notification.')
            continue
        except scheduler.exceptions.ResourceNotFoundException:
            logger.info(f'Schedule with name = {schedule_name} does not exist. Proceeding to create it.')

        schedule_datetime = datetime.strptime(order_earliest_delivery_date, '%Y-%m-%dT%H:%M:%S.%fZ') + timedelta(days=5)
        schedule_datetime_str = schedule_datetime.strftime('%Y-%m-%dT%H:%M:%S')
        schedule_expression = f'at({schedule_datetime_str})'

        # The latest date for requesting a solicitation is `LatestDeliveryDate + 30 days`
        latest_solicitation_request_datetime = datetime.strptime(order_latest_delivery_date, '%Y-%m-%dT%H:%M:%S.%fZ') + timedelta(days=30)
        latest_solicitation_request_date_str = latest_solicitation_request_datetime.strftime('%Y-%m-%dT%H:%M:%S.%fZ')

        solicitations_state_machine_arn = os.environ[Constants.SOLICITATIONS_STATE_MACHINE_ARN_ENV_VARIABLE]
        role_arn = os.environ[Constants.SOLICITATIONS_SCHEDULER_ROLE_ARN_ENV_VARIABLE]

        sandbox = json_body.get('Sandbox', 'No')

        # Input payload for the Step Functions state machine
        input_payload = {
            'OrderId': order_id,
            'MarketplaceId': marketplace_id,
            'LatestSolicitationRequestDate': latest_solicitation_request_date_str,
            'ScheduleName': schedule_name,
            'Sandbox': sandbox
        }

        # Input payload for the EventBridge schedule operation
        sfn_templated = {
            'Arn': solicitations_state_machine_arn,
            'RoleArn': role_arn,
            'Input': json.dumps(input_payload)
        }

        flex_window = { 'Mode': 'FLEXIBLE', 'MaximumWindowInMinutes': 1 }

        # Create the EventBridge schedule
        response = scheduler.create_schedule(
            Name=schedule_name,
            ScheduleExpression=schedule_expression,
            Target=sfn_templated,
            FlexibleTimeWindow=flex_window
        )

        schedule_arn = response.get('ScheduleArn')
        logger.info(f'Created schedule with arn = {schedule_arn}')

    return
