from api_utils import ApiUtils
from constants import Constants

import os
import uuid
import logging

from api_models.notifications_api.swagger_client.rest import ApiException
from api_models.notifications_api.swagger_client.models.create_destination_request import CreateDestinationRequest
from api_models.notifications_api.swagger_client.models.destination_resource_specification import DestinationResourceSpecification
from api_models.notifications_api.swagger_client.models.sqs_resource import SqsResource
from api_models.notifications_api.swagger_client.models.create_subscription_request import CreateSubscriptionRequest

'''
# Sample event input
{
    "NotificationType": "ORDER_CHANGE",
    "RegionCode": "NA",
    "RefreshToken": "Atzr|IwEBIFdeNQT9QH3..."
}
'''

def lambda_handler(event, context):
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.info('Subscribe Notifications handler started')
    logger.info(event)

    # Retrieve request details from the input payload
    notification_type = event.get('NotificationType')
    region_code = event.get('RegionCode')
    refresh_token = event.get('RefreshToken')

    # Create destination if it doesn't exist
    try:
        destination_id = create_destination(region_code, refresh_token)
        logger.info(f'Destination created - Destination Id: {destination_id}')
    except Exception as e:
        raise Exception('Create destination failed', e)

    # Create subscription
    try:
        subscription_id = create_subscription(region_code, refresh_token, notification_type, destination_id)
        logger.info(f'Subscription created - Subscription Id: {subscription_id}')

        return f'Destination Id: {destination_id} - Subscription Id: {subscription_id}'
    except Exception as e:
        raise Exception('Create subscription failed', e)

def create_destination(region_code, refresh_token):
    # Get the SQS arn from the Lambda function's environment variables
    sqs_queue_arn = os.environ[Constants.SQS_QUEUE_ARN_ENV_VARIABLE]

    sqs_resource = SqsResource(arn=sqs_queue_arn)
    resource_spec = DestinationResourceSpecification(sqs=sqs_resource)
    request = CreateDestinationRequest(name=str(uuid.uuid4()), resource_specification=resource_spec)

    # Invoke the Notifications API using a grantless notifications scope
    api_utils = ApiUtils(refresh_token, region_code, 'notifications', 'No', Constants.LWA_NOTIFICATIONS_SCOPE)

    destination_id = ''
    try:
        create_destination_response = api_utils.call_notifications_api(
            method='create_destination',
            body=request)
        destination_id = create_destination_response.payload.destination_id
    except Exception as e:
        # If the destination already exists, retrieve the destination Id
        if e.status == 409:
            get_destinations_response = api_utils.call_notifications_api(method='get_destinations')

            sqs_destination = next(
                (destination for destination in get_destinations_response.payload if
                 destination['resource']['sqs'] and sqs_queue_arn == destination['resource']['sqs']['arn']), None)

            if sqs_destination:
                destination_id = sqs_destination['destinationId']
        else:
            raise e

    return destination_id


def create_subscription(region_code, refresh_token, notification_type, destination_id):
    request = CreateSubscriptionRequest(payload_version='1.0', destination_id=destination_id)

    api_utils = ApiUtils(refresh_token, region_code, 'notifications')

    try:
        response = api_utils.call_notifications_api(
            method='create_subscription',
            body=request,
            notification_type=notification_type)
        subscription_id = response.payload.subscription_id
    except ApiException as e:
        # If a subscription for the notification types already exists, retrieve the subscription Id
        if e.status == 409:
            get_subscription_response = api_utils.call_notifications_api(
                method='get_subscription',
                notification_type=notification_type)
            subscription_id = get_subscription_response.payload.subscription_id
        else:
            raise e

    return subscription_id
