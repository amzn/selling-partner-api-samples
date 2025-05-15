#!/bin/bash

register_secrets() {

  tempFile="tmp/secrets-resource-summary.txt"
  echo "" > "$tempFile"

  ####  Client Secrets Bucket creation #####
  secret_bucket_name="spapi-clients-storage-${random_string}"
  # Ask the user whether to create S3 bucket for storing Client Secret
  while true; do
    read -p "⚠️ [IMPORTANT!!!] This script requires a Client Secret to be stored in S3. Do you want to create the S3 bucket now? [y/n] " store_secret_response
    case "$store_secret_response" in
      [yY][eE][sS]|[yY])
          region=$(aws configure get region)
          echo "Creating S3 bucket with secure configuration: ${secret_bucket_name}" >&2
          if [ "$region" == "us-east-1" ]; then
            aws s3api create-bucket \\
              --bucket "${secret_bucket_name}" \\
              >/dev/null
          else
            aws s3api create-bucket \\
              --bucket "${secret_bucket_name}" \\
              --create-bucket-configuration LocationConstraint="$region" \\
              >/dev/null
          fi

          if [ $? -ne 0 ]; then
            echo "❌ Failed to create secure S3 bucket." >&2
            return 1
          fi

          # Block all the public access
          aws s3api put-public-access-block --bucket "${secret_bucket_name}" --public-access-block-configuration \
            "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

          # Encrypted (SSE-S3)
          aws s3api put-bucket-encryption --bucket "${secret_bucket_name}" --server-side-encryption-configuration '{
            "Rules": [
              {
                "ApplyServerSideEncryptionByDefault": {
                  "SSEAlgorithm": "AES256"
                }
              }
            ]
          }'
          if [ $? -ne 0 ]; then
            echo "❌ Secret S3 bucket creation failed."
            return 1
          fi
          # Record in temp file
          echo "S3Bucket=${secret_bucket_name}" >> "$tempFile"
          echo
          echo "✅ The S3 bucket has been created: s3://${secret_bucket_name}" >&2
          echo "📌 Please upload your SP-API Client Secret to this bucket manually." >&2
          echo "   For example: echo '<YOUR_SECRET>' | aws s3 cp - s3://${secret_bucket_name}/client_secrets.csv --sse AES256" >&2
          echo "🔁 After uploading the secret, re-run this script to proceed with the deployment." >&2
          return 2
          ;;
      [nN][oO]|[nN])
          echo "Checking if required S3 bucket exists: ${secret_bucket_name}" >&2
          if aws s3api head-bucket --bucket "${secret_bucket_name}" 2>/dev/null; then
            echo "✅ S3 bucket exists. Proceeding with deployment..." >&2
            break
          else
            echo "❌ Required S3 bucket (${secret_bucket_name}) does not exist." >&2
            echo "Please re-run this script and create the bucket or ensure it exists." >&2
            return 1
          fi
          ;;
      *)
        echo "Please answer 'yes' or 'no'." >&2
        ;;
    esac
  done

  ####  Client Secrets Bucket creation #####

  # Sleeping to propagate changes
  echo "Processing ..." >&2
  sleep 15

  ####  Client Secrets  #####
  client_id=$(jq -r '.GrantlessOperationConfig.ClientId' "$config_file")
  client_secret=$(jq -r '.GrantlessOperationConfig.ClientSecret' "$config_file")
  region_code=$(jq -r '.GrantlessOperationConfig.RegionCode' "$config_file")

  ####  Client Refresh Token and other info #####
  # Extract SecretsFileName from config_json
  secrets_file_name=$(echo "$config_json" | jq -r '.SecretsFileName')

  # Check if SecretsFileName is valid
  if [ "$secrets_file_name" == "null" ] || [ -z "$secrets_file_name" ]; then
    echo "❌ 'SecretsFileName' is not defined in app-config.json" >&2
    echo "Please set 'SecretsFileName' key in the configuration." >&2
    return 1
  fi

  echo "📄 Secrets file to be loaded from S3: ${secrets_file_name}" >&2

  # Verify that the file exists in S3
  if aws s3api head-object --bucket "${secret_bucket_name}" --key "${secrets_file_name}" 2>/dev/null; then
    echo "✅ Found secrets file in S3: s3://${secret_bucket_name}/${secrets_file_name}" >&2
  else
    echo "❌ Secrets file not found in S3: s3://${secret_bucket_name}/${secrets_file_name}" >&2
    echo "Please upload the file or check the path in app-config.json" >&2
    return 1
  fi

  # Retrieve Secrets file and convert to JSON
  csv=$(aws s3 cp "s3://${secret_bucket_name}/${secrets_file_name}" - --no-progress 2>/dev/null)
  csv_json=$(echo "$csv" | tail -n +2 | jq -R -s -c \
    --arg clientId "$client_id" \
    --arg clientSecret "$client_secret" \
    --arg regionCode "$region_code" \
    '
      split("\n") | map(select(length > 0)) |
      map(split(",")) |
      map({
        clientId: $clientId,
        clientSecret: $clientSecret,
        regionCode: $regionCode,
        sellerId: .[0],
        refreshToken: .[1],
        marketplaceId: .[2],
        mail: .[3]
      })
    ')

  echo "🔐 Registering client credentials to Secrets Manager..." >&2

  max_size=60000
  chunk_index=0
  chunk=()
  chunk_arns=()

  for row in $(echo "${csv_json}" | jq -c '.[]'); do
    client_id=$(echo "$row" | jq -r '.clientId')
    seller_id=$(echo "$row" | jq -r '.sellerId')
    secret_name="SPAPIAppCredentials-${seller_id}-${random_string}"

    payload=$(echo "$row")

    # Check if secret exists
    aws secretsmanager describe-secret --secret-id "${secret_name}" >/dev/null 2>&1
    if [ $? -eq 0 ]; then
      echo "🔁 Secret already exists. Updating: ${secret_name}" >&2
      secret_arn=$(aws secretsmanager update-secret \
        --secret-id "${secret_name}" \
        --secret-string "${payload}" \
        --description "SP-API credentials for SellerId: ${seller_id}" \
        --query 'ARN' --output text)
    else
      echo "🆕 Creating new secret: ${secret_name}" >&2
      secret_arn=$(aws secretsmanager create-secret \
        --name "${secret_name}" \
        --description "SP-API credentials for SellerId: ${seller_id}" \
        --secret-string "${payload}" \
        --query 'ARN' --output text)
    fi

    if [ $? -ne 0 ]; then
      echo "❌ Failed to create secret for SellerId: ${seller_id}" >&2
      return 1
    fi

    # Record in temp file
    echo "SecretARN_${seller_id}=${secret_arn}" >> "$tempFile"

    # Add to chunk
    chunk+=("{\"${seller_id}\":\"${secret_arn}\"}")

    chunk_json="[$(IFS=, ; echo "${chunk[*]}")]"
    size=$(echo "$chunk_json" | wc -c)

    if [ "$size" -ge "$max_size" ]; then
      chunk_secret_name="SPAPISecretArn-${chunk_index}-${random_string}"

      echo "💾 Creating chunk secret: ${chunk_secret_name} (~$size bytes)" >&2
      #echo "💾 Creating chunk secret value: ${chunk_json} " >&2

      aws secretsmanager create-secret \
        --name "${chunk_secret_name}" \
        --description "Chunked list of SP-API credential secrets (part ${chunk_index})" \
        --secret-string "$chunk_json" 2>/dev/null || \
      aws secretsmanager update-secret \
        --secret-id "${chunk_secret_name}" \
        --secret-string "$chunk_json"

      if [ $? -ne 0 ]; then
        echo "❌ Failed to create chunked secret: ${chunk_secret_name}" >&2
        return 1
      fi

      chunk_arns+=("$chunk_secret_name")
      chunk=()
      ((chunk_index++))
    fi
  done

  # Flush final chunk if not empty
  if [ ${#chunk[@]} -gt 0 ]; then
    chunk_json="[$(IFS=, ; echo "${chunk[*]}")]"
    chunk_secret_name="SPAPISecretArn-${chunk_index}-${random_string}"
    echo "💾 Creating final chunk secret: ${chunk_secret_name}" >&2
    #echo "💾 Creating final　chunk secret value: ${chunk_json} " >&2

    arn=$(aws secretsmanager create-secret \
      --name "${chunk_secret_name}" \
      --description "Chunked list of SP-API credential secrets (part ${chunk_index})" \
      --secret-string "$chunk_json" \
      --query 'ARN' --output text 2>/dev/null) || \
    arn=$(aws secretsmanager update-secret \
      --secret-id "${chunk_secret_name}" \
      --secret-string "$chunk_json" \
      --query 'ARN' --output text)

    if [ $? -ne 0 ] || [ -z "$arn" ]; then
      echo "❌ Failed to create or update chunked secret: ${chunk_secret_name}" >&2
      return 1
    fi

    # Record in temp file
    echo "SecretARN_${chunk_index}=${arn}" >> "$tempFile"

    chunk_arns+=("$arn")
  fi

  echo "✅ Finished registering secrets. Total chunks: ${#chunk_arns[@]}" >&2
  comma_separated=$(IFS=, ; printf "%s" "${chunk_arns[*]}")

  echo "$comma_separated"
  return 0
}
