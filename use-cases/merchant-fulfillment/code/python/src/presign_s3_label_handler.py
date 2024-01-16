import os
import io
import uuid
import gzip
import boto3
import base64
import logging

from botocore.client import Config
from datetime import datetime, timedelta

from src.utils import constants
from src.utils.mfn_utils import LABEL_FORMAT

from src.api_models.mfn_api.swagger_client.models.file_contents import FileContents
from src.api_models.mfn_api.swagger_client.models.label import Label
from src.api_models.mfn_api.swagger_client.models.package_dimensions import PackageDimensions


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def lambda_handler(event, context):
    logger.info(f"PresignS3Label Lambda input: {event}")

    # Extract order ID from event
    order_id = event[constants.STATE_MACHINE_ORDER_ID_KEY_NAME]

    try:
        s3_bucket_name = os.environ.get(constants.LABELS_S3_BUCKET_NAME_ENV_VARIABLE)
        object_key = f"{order_id}/{uuid.uuid4()}"

        label = get_label_content(label_content=event[constants.LABEL_NAME_KEY])

        # Store the label in S3
        store_label(s3_bucket_name, object_key, label)
        logger.info("Label successfully stored")

        # Generate a presigned URL to browse the label
        presigned_url = generate_presigned_url(s3_bucket_name, object_key)
        logger.info("Presigned URL successfully generated")

        return presigned_url
    except Exception as e:
        raise Exception("Label presigned URL generation failed", e)


def store_label(s3_bucket_name, object_key, label):
    label_content_bytes = decode_label_content(label)
    input_stream = io.BytesIO(label_content_bytes)

    metadata = {
        constants.CONTENT_TYPE_KEY_NAME: constants.CONTENT_TYPE_METADATA_MAP[label.label_format]
    }

    s3 = boto3.client(constants.AWS_S3_CLIENT_KEY_NAME, config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    s3.upload_fileobj(input_stream, s3_bucket_name, object_key, ExtraArgs=metadata)


def decode_label_content(label):
    label_content_decoded = base64.b64decode(label.file_contents.contents)

    try:
        with gzip.GzipFile(fileobj=io.BytesIO(label_content_decoded), mode='rb') as gz:
            uncompressed = gz.read()
        return uncompressed
    except Exception as e:
        raise Exception("Decoding and decompressing label failed", e)


def generate_presigned_url(s3_bucket_name, object_key):
    # Set the presigned URL to expire after one hour
    expiration_time = datetime.utcnow() + timedelta(hours=1)

    s3 = boto3.client(constants.AWS_S3_CLIENT_KEY_NAME, config=Config(signature_version=constants.AWS_SIGNATURE_VERSION))
    presigned_url = s3.generate_presigned_url(
        'get_object',
        Params={constants.AWS_S3_BUCKET_KEY_NAME: s3_bucket_name, constants.AWS_S3_KEY_NAME: object_key},
        ExpiresIn=expiration_time  # 1 hour
    )
    return presigned_url


def get_label_content(label_content):
    file_contents = FileContents(**label_content.get('fileContents', {}))
    dimensions = PackageDimensions(**label_content.get('dimensions', {}))

    return Label(label_format=LABEL_FORMAT, file_contents=file_contents, dimensions=dimensions)
