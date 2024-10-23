import logging
import os
import boto3

from utils import constants
from utils import scheduler_utils
from utils.scheduler_utils import SchedulerLambdaInput

logger = logging.getLogger()
logger.setLevel(logging.INFO)

"""
{
    "accountId": "ABC123DE",
    "queryHash": "a54204af181334bb80a9c329b092aad0",
     - OR -
    "query": "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin(aggregateBy:CHILD endDate:\"10-05-2025\" startDate:\"10-06-2025\"){sku traffic{browserSessions pageViews}}}}"
}
"""

scheduler = boto3.client('scheduler')
dynamodb = boto3.resource('dynamodb')


def lambda_handler(event, context):
    scheduler_lambda_input = SchedulerLambdaInput(**event)

    # Log the input event for the Lambda
    logger.info(f"Delete Schedule Lambda input: {event}")

    try:
        if not scheduler_lambda_input.accountId:
            raise ValueError("'accountId' must be provided.")

        if not scheduler_lambda_input.queryHash:
            if not scheduler_lambda_input.query:
                raise ValueError("'query' must be provided if 'queryHash' is not provided.")
            scheduler_lambda_input.queryHash = scheduler_utils.create_hash(scheduler_lambda_input.query,
                                                                           scheduler_lambda_input.accountId)

        scheduler_lambda_input.scheduleName = f"{constants.SCHEDULER_QUERY_NAME}-{scheduler_lambda_input.accountId}-{scheduler_lambda_input.queryHash}"

        delete_schedule(account_id=scheduler_lambda_input.accountId, query_hash=scheduler_lambda_input.queryHash,
                        schedule_name=scheduler_lambda_input.scheduleName)

        return (f"Schedule {scheduler_lambda_input.queryHash} for "
                f"{scheduler_lambda_input.accountId} has been successfully deleted.")

    except Exception as e:
        raise Exception("Scheduling Data Kiosk API failed", e.__dict__)


def delete_schedule(account_id=None, query_hash=None, schedule_name=None):
    random_suffix = os.environ[constants.RANDOM_SUFFIX_ENV_VARIABLE]
    scheduler_group_name = constants.SCHEDULER_GROUP_NAME + random_suffix

    logger.info(f"Schedule {schedule_name} has been successfully deleted.")
    # Get DynamoDB table name from environment variables
    table_name = os.environ.get(constants.SCHEDULED_QUERIES_TABLE_ENV_NAME)
    # Get the DynamoDB table
    dynamo_table = dynamodb.Table(table_name)
    # Define the key of the item you want to delete
    key = {
        constants.SCHEDULED_QUERIES_TABLE_ACCOUNT_ID_KEY_NAME: account_id,
        constants.SCHEDULED_QUERIES_TABLE_QUERY_HASH_KEY_NAME: query_hash
    }

    # Delete the item
    response = dynamo_table.delete_item(
        TableName=table_name,
        Key=key
    )
    logger.info(f"{response} - Schedule {schedule_name} has been removed from DB.")
    scheduler.delete_schedule(Name=schedule_name, GroupName=scheduler_group_name)
    logger.info(f"EventBridge Schedule {schedule_name} has been deleted.")


def validate_schedule(schedule_name):
    try:
        response = scheduler.describe_schedule(Name=schedule_name)
        if response.get('State') == 'ENABLED':
            return True, "Schedule is valid and enabled."
        else:
            return False, "Schedule is not enabled."
    except scheduler.exceptions.ResourceNotFoundException:
        return False, "Schedule does not exist."
    except Exception as e:
        return False, f"An error occurred: {str(e)}"
