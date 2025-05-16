# Azure Queue Storage Connection String Integration

This folder contains tools and instructions for securely managing the Azure Queue Storage connection string used by AWS Lambda to send messages.

### Files

- `<your-connection-string-file>.txt`  
  A plain text file containing the Azure Storage connection string.  
  This file contains sensitive credentials and **should not be committed** to source control.

  #### Sample content:

```json
DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=xxxxx...==;EndpointSuffix=core.windows.net
```

- `generate-azure-storage-queue-secret-resource.sh`  
  A script to:
- Upload the connection string to AWS Secrets Manager
- Save the returned secret ARN to a file
- Optionally delete the local file for security

- `secret_arn.txt`  
  Contains the ARN of the uploaded secret which you need to specify at `AzureQueueConnectionStringArn` in app-config.json
  ```json
      "CrossPlatform": {
        "DestinationType": "AZURE_STORAGE_QUEUE",
        "AzureQueueConnectionStringArn": "arn:aws:secretsmanager:us-west-X:XXXXXXXXXXX:secret:AZURE_QUEUE_CONNECTION_STRING-XXXXXX",
        "AzureQueueName": "my-azure-storage-queue-name"
      }

---

###  Usage

#### 1. Run the script with a file path

```bash
./generate-azure-storage-queue-secret-resource.sh <your-connection-string-file>.txt
