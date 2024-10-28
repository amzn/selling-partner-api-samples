import os
import boto3
import logging
import json
from datetime import datetime, timedelta

from utils import constants
from utils import scheduler_utils
from utils.scheduler_utils import SchedulerLambdaInput

logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Retrieve request details from the input payload
    scheduler_lambda_input = SchedulerLambdaInput(**event)

    query_date_format = scheduler_lambda_input.dataset.dateFormat
    schedule_start_date = datetime.strptime(scheduler_lambda_input.scheduleStartDate, constants.SCHEDULER_DATE_FORMAT)

    schedule_date_difference = (datetime.now() - schedule_start_date).total_seconds() / 60
    number_of_schedules = schedule_date_difference // int(scheduler_lambda_input.minuteRate)

    query_start_date = datetime.strptime(scheduler_lambda_input.dataset.queryStartDate, query_date_format)
    new_query_start_date = (
                query_start_date + timedelta(minutes=int(scheduler_lambda_input.minuteRate) * int(number_of_schedules)))
    new_query_end_date = new_query_start_date + timedelta(minutes=scheduler_lambda_input.dataset.dateDifference)

    event = {
        "query": scheduler_lambda_input.dataset.newQuery
    }

    new_query_start_date_str = new_query_start_date.strftime(query_date_format)
    new_query_end_date_str = new_query_end_date.strftime(query_date_format)

    dataset_obj = scheduler_utils.extract_dataset_info(event, new_query_start_date_str, new_query_end_date_str)

    # Input payload for the Step Functions state machine
    input_payload = {
        "Query": dataset_obj.newQuery
    }

    create_query_lambda_function_arn = os.environ[constants.CREATE_QUERY_LAMBDA_FUNCTION_ARN_ENV_NAME]

    # Trigger Create Query Lambda function
    lambda_client = boto3.client('lambda')

    response = lambda_client.invoke_async(
        FunctionName=create_query_lambda_function_arn,
        InvokeArgs=json.dumps(input_payload),
    )

    return f"Create Query triggered with {input_payload}, Response is : {response}"
