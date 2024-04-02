import os
import io
import uuid
import boto3
import base64
import logging

from botocore.client import Config

from src.utils.shipping_utils import ShippingLambdaInput
from src.utils import constants

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    logger.info(f"PresignS3Label Lambda input: {event}")

    try:
        presign_label_lambda_input = ShippingLambdaInput(**event)

        # Create S3 Bucket Name
        s3_bucket_name = os.environ.get(constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE)

        # Extract order ID from event
        order_id = presign_label_lambda_input.credentials.orderId

        object_key = f"{order_id}/{uuid.uuid4()}"

        label = presign_label_lambda_input.label.fileContents
        label_format = presign_label_lambda_input.label.labelFormat

        # Store the label in S3
        store_label(s3_bucket_name, object_key, label, label_format)
        logger.info("Label successfully stored")

        # Generate a presigned URL to browse the label
        presigned_url = generate_presigned_url(s3_bucket_name, object_key)
        logger.info("Presigned URL successfully generated")

        return presigned_url
    except Exception as e:
        logger.error("Label presigned URL generation failed: %s", e)
        raise e


def store_label(s3_bucket_name, object_key, label_content, label_format):
    label_content_bytes = decode_label_content(label_content)
    input_stream = io.BytesIO(label_content_bytes)

    content_type = 'application/octet-stream'  # Default content type

    if label_format == 'PDF':
        content_type = 'application/pdf'
    elif label_format == 'PNG':
        content_type = 'image/png'
    elif label_format == 'ZPL':
        content_type = 'application/x-zpl'

    metadata = {
        'ContentType': content_type
    }

    s3 = boto3.client('s3', config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    s3.upload_fileobj(input_stream, s3_bucket_name, object_key, ExtraArgs=metadata)


def decode_label_content(label_content):
    label_content_decoded = base64.b64decode(label_content)
    return label_content_decoded


def generate_presigned_url(s3_bucket_name, object_key):
    s3 = boto3.client('s3', config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': s3_bucket_name, 'Key': object_key},
        ExpiresIn=3600  # 1 hour in seconds
    )
    return presigned_url
