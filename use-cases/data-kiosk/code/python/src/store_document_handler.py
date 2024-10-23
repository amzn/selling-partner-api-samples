import boto3
from botocore.exceptions import ClientError
import logging
import os
import gzip
import urllib.request, urllib.error
from dataclasses import asdict

from utils import constants
from utils.query_utils import DataKioskLambdaInput

# Set up logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


def lambda_handler(event, context):
    # Log the input event for the Lambda
    logger.info(f"StoreDocument Lambda input: {event}")

    try:
        # Parse the incoming event data into a DataKioskLambdaInput object
        dk_lambda_input = DataKioskLambdaInput(**event)

        # Store the document in S3 and get a URI
        s3_uri = store_document_in_s3(dk_lambda_input)

        # Store document details in DynamoDB
        store_document_id_in_dynamodb(s3_uri, dk_lambda_input=dk_lambda_input)

        # Return the S3 URI for the stored document
        dk_lambda_input.document.s3Uri = s3_uri
        return asdict(dk_lambda_input)

    except RuntimeError as e:
        # Raise an exception if there's an error
        raise Exception("Calling Data Kiosk API failed", e.__dict__)


def store_document_in_s3(dk_lambda_input):
    try:
        # Initialize S3 client
        s3_client = boto3.client('s3')
        # Get S3 bucket name from environment variables
        s3_bucket = os.environ.get(constants.DATAKIOSK_DOCUMENTS_S3_BUCKET_NAME_ENV_VARIABLE)
        # Set S3 key for the document
        s3_key = f"{dk_lambda_input.accountId}+{dk_lambda_input.queryId}.json"

        # Decode JSON content from Document Url
        json_content = get_json_from_url(url=dk_lambda_input.document.documentUrl)

        # Upload the document to S3
        s3_client.put_object(Bucket=s3_bucket, Key=s3_key, Body=json_content)

        # Formulate the S3 URI
        s3_uri = f"s3://{s3_bucket}/{s3_key}"

    except ClientError as e:
        # Raise a runtime error if storing the document in S3 fails
        raise RuntimeError(f"Failed to store document in S3: {str(e)}")
    return s3_uri


def get_json_from_url(url):
    with urllib.request.urlopen(url) as response:
        if response.getcode() != 200:
            print(f"Call to download content was unsuccessful with response code: {response.getcode()}")
            return None

        data = response.read()

        # Check if the content is gzipped
        if response.info().get('Content-Encoding') == 'gzip':
            data = gzip.decompress(data)

        # Decode the content as UTF-8
        decoded_data = data.decode('utf-8')
        return data


def store_document_id_in_dynamodb(s3_uri, dk_lambda_input):
    try:
        # Initialize DynamoDB resource
        dynamodb = boto3.resource('dynamodb')
        # Get DynamoDB table name from environment variables
        table_name = os.environ.get(constants.QUERY_ITEMS_TABLE_NAME_ENV_VARIABLE)
        # Get the DynamoDB table
        dynamo_table = dynamodb.Table(table_name)

        # Define the resource to be stored in DynamoDB
        resource = {
            "AccountId": dk_lambda_input.accountId,
            "QueryId": dk_lambda_input.queryId,
            "Query": dk_lambda_input.query,
            "DocumentId": dk_lambda_input.document.documentId,
            "DocumentS3": s3_uri,
            "ProcessingStatus": dk_lambda_input.processingStatus
        }

        # Put the item into DynamoDB table
        dynamo_table.put_item(Item=resource)
    except ClientError as e:
        # Raise a runtime error if storing the document ID in DynamoDB fails
        raise RuntimeError(f"Failed to store documentId in DynamoDB: {str(e)}")
