#!/bin/bash

# Get the programming language from the input arguments
language=""
while getopts 'l:' flag; do
  case "${flag}" in
    l) language="${OPTARG}";;
  esac
done

# Set the Lambda runtime based on the programming language
runtime=""
case "${language}" in
  python) runtime="python3.11";;
  java) runtime="java17";;
*) echo "Undefined language"; exit;;
esac

# Verify pre-requisites
source ../shared/pre-requisites.sh $language
if [ $? -ne 0 ]
then
  echo "Verifying pre-requisites failed"
  echo "Aborting"
  exit -1
fi

# Generate a random string of 6 characters
random_suffix_file="tmp/random_suffix.txt"
if [ -f "$random_suffix_file" ]; then
  echo "Reusing existing random_suffix from $random_suffix_file"
  random_string=$(cat "$random_suffix_file")
else
  echo "Generating new random_suffix"
  random_string=$(LC_ALL=C tr -dc 'a-z' < /dev/urandom | fold -w 6 | head -n 1)
  mkdir -p tmp
  echo "$random_string" > "$random_suffix_file"
fi

# Create and attach the IAM policy
policy_name="sp-api-app-policy-${random_string}"
echo "Checking if IAM policy '${policy_name}' already exists..."

# Search existing policy
policy_arn=$(aws iam list-policies \
  --scope Local \
  --query "Policies[?PolicyName=='${policy_name}'].Arn" \
  --output text)

if [ -n "$policy_arn" ]; then
  echo "✅ Policy already exists. ARN: ${policy_arn}"
else
  echo "🚧 Policy does not exist. Creating new policy: ${policy_name}..."

  policy_arn=$(aws iam create-policy \
    --policy-name "${policy_name}" \
    --policy-document file://../iam-policy.json \
    --query "Policy.Arn" \
    --output text)

  if [ $? -ne 0 ] || [ -z "$policy_arn" ]; then
    echo "❌ IAM policy creation failed or returned empty ARN."
    echo "Aborting."
    exit 1
  fi

  echo "✅ Created new policy. ARN: ${policy_arn}"
fi


# Sleeping to propagate changes
echo "Processing ..."
sleep 15

# Bootstrap CDK environment
echo "Bootstrapping CDK environment"
aws_account_id=$(aws sts get-caller-identity --query "Account" --output text)
aws_region=$(aws configure get region)
cdk_namespace="spapi"
cdk bootstrap --qualifier "${cdk_namespace}" aws://${aws_account_id}/${aws_region} --cloudformation-execution-policies "${policy_arn}"
if [ $? -ne 0 ]
then
  echo "Bootstrapping CDK environment failed."
  echo "Aborting"
  exit -1
fi

# Retrieve config values
config_file="../../config/app-config.json"
config_json=$(jq -c '.' "${config_file}")

# Register secrets
source ../shared/secrets.sh

# Export for use in register_secrets
export random_string
export config_json

secret_result=$(register_secrets)
exit_code=$?

if [ "$exit_code" -eq 1 ]; then
  echo "❌ Failed to register secrets"
  exit 1
fi

if [ $exit_code -eq 2 ]; then
  exit 1
fi

# The AWS CLI `cp` command outputs extra JSON to stdout,
# so we filter the result using grep to extract only the secret ARNs.
comma_separated=$(echo "$secret_result" | grep -E '^arn:aws:secretsmanager:')

if [ -z "$comma_separated" ]; then
  echo "❗️ register_secrets returned empty result"
  exit 1
fi

echo "📦 Comma-separated secret names: $comma_separated"

# Load notification types from config
notification_types=$(jq -r '.NotificationTypes[].NotificationType' "$config_file")

# Notification Type Definition file
notification_type_def_file="../../config/notification-type-definition.json"
notification_type_json=$(jq -c '.' "${notification_type_def_file}")

# Register EventBridge
source ../shared/event-bridge.sh

# Export for use in register_secrets
export notification_types
export notification_type_def_file
export config_file
export aws_account_id
export aws_region

eventbridge_result=$(register_event_bridge)
exit_code=$?

if [ $exit_code -ne 0 ]; then
  echo "❌ Failed to register EventBridge"
  exit 1
fi

if [ -z "$eventbridge_result" ]; then
  echo "❗️ register_EventBridge returned empty result"
  exit 1
fi

IFS='|' read destination_id event_bus_arn <<< "$eventbridge_result"
echo "destination_id: ${destination_id}"
echo "event_bus_arn: ${event_bus_arn}"

# Create the S3 bucket to host application code
echo "Creating S3 bucket"
bucket_name="sp-api-app-bucket-${random_string}"

echo "Checking if S3 bucket already exists: ${bucket_name}"
if aws s3api head-bucket --bucket "${bucket_name}" 2>/dev/null; then
  echo "✅ S3 bucket already exists. Skipping creation."
else
  echo "Creating S3 bucket: ${bucket_name}"
  aws s3 mb "s3://${bucket_name}"
  if [ $? -ne 0 ]; then
    echo "❌ S3 bucket creation failed."
    echo "Aborting."
    exit 1
  fi
fi

# Sleeping to propagate changes
echo "Processing ..."
sleep 15

if [ "$language" == "java" ]; then
  echo "Packaging and uploading Java code"

  java_code_folder="../../../code/java/"
  java_code_jar="target/sp-api-java-app-1.0.jar"
  timestamp=$(date +%s)
  code_s3_key="src/sp-api-java-app-${timestamp}.jar"
  s3_record_file=".last_s3_key"

  default_web_hook_sqs_notification_handler="lambda.process.webhook.SQSNotificationsHandler"
  default_web_hook_event_bridge_notification_handler="lambda.process.webhook.EventBridgeNotificationsHandler"
  default_web_hook_sqs_reprocess_handler="lambda.process.webhook.SQSReprocessHandler"
  default_cross_platform_sqs_notification_handler="lambda.process.crossplatform.SQSNotificationsHandler"
  default_cross_platform_event_bridge_notification_handler="lambda.process.crossplatform.EventBridgeNotificationsHandler"
  default_cross_platform_sqs_reprocess_handler="lambda.process.crossplatform.SQSReprocessHandler"
  default_internal_sqs_notification_handler="lambda.process.internal.SQSNotificationsHandler"
  default_internal_event_bridge_notification_handler="lambda.process.internal.EventBridgeNotificationsHandler"
  default_internal_sqs_reprocess_handler="lambda.process.internal.SQSReprocessHandler"
  subscribe_notifications_handler="lambda.subscription.SubscribeNotificationsHandler"
  unsubscribe_notifications_handler="lambda.subscription.UnsubscribeNotificationsHandler"

  mvn validate -f "${java_code_folder}pom.xml"
  mvn package -f "${java_code_folder}pom.xml"

  # Upload
  echo "Uploading new jar to S3: $code_s3_key"
  aws s3 cp "${java_code_folder}${java_code_jar}" "s3://${bucket_name}/${code_s3_key}"

  # Delete last file
  if [ -f "$s3_record_file" ]; then
    old_key=$(cat "$s3_record_file")
    echo "Deleting old jar from S3: $old_key"
    aws s3 rm "s3://${bucket_name}/${old_key}"
  fi

  # Save the new key
  echo "$code_s3_key" > "$s3_record_file"
fi

# Upload the StepFunctions state machine definition to S3

count=$(jq '.NotificationTypes | length' "$config_file")

for ((i = 0; i < count; i++)); do
  step_functions=$(jq -r ".NotificationTypes[$i].Internal?.StepFunctions" "$config_file")

  if [ "$step_functions" != "null" ]; then
    keys=$(echo "$step_functions" | jq -r 'keys[]')

    for key in $keys; do
      definition_path=$(jq -r ".NotificationTypes[$i].Internal.StepFunctions[\"$key\"].Definitions // empty" "$config_file")

      if [ -n "$definition_path" ]; then
        echo "📦 Found Step Function definition for '$key' at: $definition_path"

        state_machine_s3_key="$definition_path"

        # Check if file exists (just for logging purpose)
        if aws s3api head-object --bucket "$bucket_name" --key "$state_machine_s3_key" >/dev/null 2>&1; then
          echo "⚠️ File already exists in S3 (will be overwritten): $state_machine_s3_key"
        fi

        echo "⬆ Uploading to s3://${bucket_name}/${state_machine_s3_key} ..."
        aws s3 cp "../../$definition_path" "s3://${bucket_name}/${state_machine_s3_key}"
        if [ $? -ne 0 ]; then
          echo "❌ Failed to upload $definition_path"
          exit 1
        fi
      fi
    done
  fi
done

#Create the infrastructure using CDK
cdk_stack_path="../../sp-api-app-cdk/"
stack_name="sp-api-app-cdk-${random_string}"
app_command="npx ts-node --prefer-ts-exts ${cdk_stack_path}bin/sp-api-app-cdk.ts"
cdk_deploy_output="${cdk_stack_path}cdk.out"

# Install npm dependencies
echo "Installing npm dependencies for the cdk stack project..."
currentPath=$(PWD)
cd "${cdk_stack_path}" && npm install
cd "${currentPath}" || exit

# Sleeping to propagate changes
echo "Processing ..."
sleep 15

# Deploy the CDK stack
echo "Creating CDK stack..."
cdk deploy "${stack_name}" --output "${cdk_deploy_output}" --app "${app_command}" --require-approval never \
  -c RANDOM_SUFFIX="${random_string}" \
  -c CDK_QUALIFIER="${cdk_namespace}" \
  -c APP_CONFIG="${config_json}" \
  -c NOTIFICATION_TYPE_DEF_JSON="${notification_type_json}" \
  -c CHUNKED_SECRET_NAMES="$comma_separated" \
  -c LAMBDA_CODE_S3_KEY="${code_s3_key}" \
  -c EVENT_BUS_ARN="$event_bus_arn" \
  -c DESTINATION_ID="$destination_id" \
  -c PROGRAMMING_LANGUAGE="${runtime}" \
  --parameters artifactsS3BucketName="${bucket_name}" \
  --parameters spapiDefaultWebHookSqsNotificationHandler="${default_web_hook_sqs_notification_handler}" \
  --parameters spapiDefaultWebHookEventBridgeNotificationHandler="${default_web_hook_event_bridge_notification_handler}" \
  --parameters spapiDefaultWebHookSqsReprocessHandler="${default_web_hook_sqs_reprocess_handler}" \
  --parameters spapiDefaultCrossPlatformSqsNotificationHandler="${default_cross_platform_sqs_notification_handler}" \
  --parameters spapiDefaultCrossPlatformEventBridgeNotificationHandler="${default_cross_platform_event_bridge_notification_handler}" \
  --parameters spapiDefaultCrossPlatformSqsReprocessHandler="${default_cross_platform_sqs_reprocess_handler}" \
  --parameters spapiDefaultInternalSqsNotificationHandler="${default_internal_sqs_notification_handler}" \
  --parameters spapiDefaultInternalEventBridgeNotificationHandler="${default_internal_event_bridge_notification_handler}" \
  --parameters spapiDefaultInternalSqsReprocessHandler="${default_internal_sqs_reprocess_handler}" \
  --parameters spapiSubscribeNotificationsLambdaFunctionHandler="${subscribe_notifications_handler}" \
  --parameters spapiUnsubscribeNotificationsLambdaFunctionHandler="${unsubscribe_notifications_handler}"


if [ $? -ne 0 ]; then
  echo "CDK stack creation failed"
  echo "Aborting"
  exit -1
fi

# Store resources' IDs in a tmp file for future clean-up
echo "Storing resources' IDs in a tmp file"
tempdir="tmp"
if [ ! -d "$tempdir" ]; then
  mkdir "$tempdir"
fi
filename="tmp/resources.txt"
exec 3<> "$filename"
echo "policy_arn=$policy_arn" >&3
echo "bucket_name=$bucket_name" >&3
echo "app_command=$app_command" >&3
echo "stack_name=$stack_name" >&3
echo "cdk_deploy_output=$cdk_deploy_output" >&3
echo "random_suffix=$random_string" >&3
echo "aws_account_id=$aws_account_id" >&3
echo "aws_region=$aws_region" >&3
echo "cdk_namespace=$cdk_namespace" >&3
echo "comma_separated=$comma_separated" >&3
exec 3>&-

echo "Successfully created an SP-API app"
