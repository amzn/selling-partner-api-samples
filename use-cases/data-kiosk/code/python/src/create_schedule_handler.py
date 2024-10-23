import logging
import os
import boto3
import json

from dataclasses import asdict

from utils import constants
from utils import scheduler_utils
from utils.scheduler_utils import SchedulerLambdaInput

logger = logging.getLogger()
logger.setLevel(logging.INFO)

'''
    {
      "query": "query MyQuery{analytics_salesAndTraffic_2023_11_15{salesAndTrafficByAsin...",
      "scheduleStartDate": "2024-07-09T14:34:00",
      "scheduleEndDate": "2024-07-23T08:00:00",
      "minuteRate": "2",
      "accountId": "ABC123DE"
    }
'''

scheduler = boto3.client('scheduler')
dynamodb = boto3.resource('dynamodb')


def lambda_handler(event, context):
    scheduler_lambda_input = SchedulerLambdaInput(**event)
    scheduler_lambda_input.dataset = scheduler_utils.extract_dataset_info(event)

    # Log the input event for the Lambda
    logger.info(f"Create Schedule Lambda input: {event}")

    try:
        if not event.get(constants.QUERY_HASH_KEY_NAME):
            scheduler_lambda_input.queryHash = scheduler_utils.create_hash(scheduler_lambda_input.query,
                                                                           scheduler_lambda_input.accountId)
        else:
            scheduler_lambda_input.queryHash = event.get(constants.QUERY_HASH_KEY_NAME)

        scheduler_lambda_input.scheduleName = (f"{constants.SCHEDULER_QUERY_NAME}-"
                                               f"{scheduler_lambda_input.accountId}-{scheduler_lambda_input.queryHash}")

        create_schedule(scheduler_lambda_input)

        return (f"Schedule {scheduler_lambda_input.queryHash} "
                f"for {scheduler_lambda_input.accountId} has been successfully created!")

    except Exception as e:
        raise Exception("Scheduling Data Kiosk API failed", e)


def create_schedule(scheduler_lambda_input):
    # If a schedule rate is less than the data reload period for the dataset, skip
    if scheduler_lambda_input.minuteRate < scheduler_lambda_input.dataset.dataReloadPeriod:
        raise Exception(f"Scheduling Data Kiosk API failed - minute rate {scheduler_lambda_input.minuteRate} "
                        f"is less than the data reload period {scheduler_lambda_input.dataset.dataReloadPeriod} "
                        f"for dataset {scheduler_lambda_input.dataset.datasetName}. "
                        f"The scheduler will not have any new data for this rate. "
                        f"Make sure to set a rate equal to or greater than the data reload period.")

    # If a schedule for the order already exists, skip the creation of a new schedule
    try:
        scheduler.get_schedule(Name=scheduler_lambda_input.scheduleName)
        logger.info(
            f"Schedule with name = {scheduler_lambda_input.scheduleName} already exists. Skipping notification.")
    except scheduler.exceptions.ResourceNotFoundException:
        logger.info(
            f"Schedule with name = {scheduler_lambda_input.scheduleName} doesn't exist. Proceeding to create it.")

    # Create Scheduler Input Parameters
    schedule_expression = f"rate({scheduler_lambda_input.minuteRate} minutes)"
    random_suffix = os.environ[constants.RANDOM_SUFFIX_ENV_VARIABLE]

    role_arn = os.environ[constants.CREATE_SCHEDULE_ROLE_ARN_ENV_NAME]
    create_query_lambda_function_arn = os.environ[constants.CREATE_SCHEDULED_QUERY_LAMBDA_FUNCTION_ARN_ENV_NAME]

    # Input payload for the EventBridge schedule operation
    sfn_templated = {
        "RoleArn": role_arn,
        "Arn": create_query_lambda_function_arn,
        "Input": json.dumps(asdict(scheduler_lambda_input))
    }

    scheduler_group_name = constants.SCHEDULER_GROUP_NAME + random_suffix

    scheduled_group_list = scheduler.list_schedule_groups().get('ScheduleGroups', [])
    is_group_created = any(group.get('Name') == scheduler_group_name for group in scheduled_group_list)

    if not is_group_created:
        scheduler.create_schedule_group(
            Name=scheduler_group_name,
            Tags=scheduler_utils.tag_value
        )

    # Create the EventBridge schedule with schedule
    schedule_arn = scheduler.create_schedule(
        Name=scheduler_lambda_input.scheduleName,
        ScheduleExpression=schedule_expression,
        StartDate=scheduler_lambda_input.scheduleStartDate,
        EndDate=scheduler_lambda_input.scheduleEndDate,
        Target=sfn_templated,
        FlexibleTimeWindow=scheduler_utils.flex_window,
        GroupName=scheduler_group_name
    )

    logger.info(f"Created schedule with arn = {schedule_arn}")
    add_item_to_db(scheduler_lambda_input)
    logger.info(f"Schedule {scheduler_lambda_input.scheduleName} schedule has been successfully initialized.")
    return schedule_arn


def add_item_to_db(scheduler_lambda_input):
    # Define the resource to be stored in DynamoDB
    item = {
        constants.ACCOUNT_ID_KEY_NAME: scheduler_lambda_input.accountId,
        constants.QUERY_HASH_KEY_NAME: scheduler_lambda_input.queryHash,
        constants.QUERY_CODE_KEY_NAME: scheduler_lambda_input.query,
        constants.START_DATE_KEY_NAME: scheduler_lambda_input.scheduleStartDate,
        constants.MINUTE_RATE_KEY_NAME: scheduler_lambda_input.minuteRate
    }

    # Get DynamoDB table name from environment variables
    table_name = os.environ.get(constants.SCHEDULED_QUERIES_TABLE_ENV_NAME)

    # Get the DynamoDB table
    dynamo_table = dynamodb.Table(table_name)
    dynamo_table.put_item(Item=item)
    logger.info(f"Added schedule item to DB - {item}")
