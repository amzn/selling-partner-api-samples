# GCP Pub/Sub Key Integration

This folder contains tools and instructions for securely handling a Google Cloud Platform (GCP) service account key (`key.json`) used to publish messages to GCP Pub/Sub from AWS Lambda.

###  Files

- `<your-key-file>.json`  
  A GCP service account key file in JSON format (e.g., `key.json`, `my-gcp-pubsub-key.json`).  
  This file contains sensitive credentials and **should not be committed** to source control.

  ####  Sample content:

  ```json
  {
    "type": "service_account",
    "project_id": "your-gcp-project-id",
    "private_key_id": "abcd1234abcd5678",
    "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkq...\n-----END PRIVATE KEY-----\n",
    "client_email": "your-service-account@your-gcp-project-id.iam.gserviceaccount.com",
    "client_id": "12345678901234567890",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/your-service-account%40your-gcp-project-id.iam.gserviceaccount.com"
  }
  
- `generate-gcp-pubsub-secret-resource.sh`  
  A script to:
    - Upload `key.json` to AWS Secrets Manager
    - Save the returned secret ARN to a file
    - Optionally delete the local `key.json` file for security

- `secret_arn.txt`  
  A plain text file containing the ARN of the uploaded secret which you need to specify at `GcpPubsubKeyArn` in app-config.json
  ```json
      "CrossPlatform": {
        "DestinationType": "GCP_PUBSUB",
        "GcpProjectId": "my-gcp-project-id",
        "GcpTopicId": "my-gcp-topic-id",
        "GcpPubsubKeyArn": "arn:aws:secretsmanager:us-west-X:XXXXXXXXXXXX:secret:GCP_SPAPI_PUBSUB_KEY-XXXXXXX"
      }

---

###  Usage

#### 1. Run the script with a file path

```bash
./generate-gcp-pubsub-secret-resource.sh <your-key-file>.json
