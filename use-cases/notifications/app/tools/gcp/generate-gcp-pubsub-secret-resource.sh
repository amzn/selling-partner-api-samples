#!/bin/bash

# Set variables
if [ -n "$1" ]; then
  KEY_FILE_PATH="$1"
else
  read -p "📄 Enter the path to the key.json file: " KEY_FILE_PATH
fi
SECRET_NAME="GCP_SPAPI_PUBSUB_KEY"
OUTPUT_ARN_FILE="secret_arn.txt"

# Check if the key file exists
if [ ! -f "$KEY_FILE_PATH" ]; then
  echo "❌ key.json not found at $KEY_FILE_PATH"
  exit 1
fi

# Create secret in AWS Secrets Manager
echo "🔐 Creating secret: $SECRET_NAME from $KEY_FILE_PATH..."
create_output=$(aws secretsmanager create-secret \
  --name "$SECRET_NAME" \
  --secret-string file://"$KEY_FILE_PATH" \
  2>&1)

# Check for success or existing secret
if echo "$create_output" | grep -q "ResourceExistsException"; then
  echo "ℹ️ Secret already exists. Skipping creation..."
  # Retrieve existing secret's ARN
  secret_arn=$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --query ARN --output text)
else
  echo "✅ Secret created successfully."
  # Extract ARN from creation output
  secret_arn=$(echo "$create_output" | jq -r '.ARN')
fi

# Save the secret ARN to a file
echo "📄 Saving secret ARN to $OUTPUT_ARN_FILE"
echo "$secret_arn" > "$OUTPUT_ARN_FILE"

# Delete the local key file
echo "🗑️ The key file contains sensitive credentials: $KEY_FILE_PATH"
read -p "⚠️ Do you want to delete the local key file for security reasons? [y/N] " confirm_delete

if [[ "$confirm_delete" =~ ^[Yy]$ ]]; then
  echo "🗑️ Deleting local key file: $KEY_FILE_PATH"
  rm -f "$KEY_FILE_PATH"
  echo "✅ File deleted."
else
  echo "⚠️ Skipping deletion. Please make sure to handle the file securely."
fi

echo "✅ Done. Secret ARN: $secret_arn"
