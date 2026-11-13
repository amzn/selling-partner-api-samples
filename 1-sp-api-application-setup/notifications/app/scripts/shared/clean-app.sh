#!/bin/bash


# Get the programming language from the input arguments
language=""
resources_file=""
while getopts 'l:p:' flag; do
  case "${flag}" in
    l) language="${OPTARG}" ;;
    p) resources_file="${OPTARG}" ;;
    *) echo "Unsupported flag ${flag}"; exit 1 ;;
  esac
done

# Set the Lambda runtime based on the programming language
runtime=""
case "${language}" in
  python) runtime="python3.11";;
  java) runtime="java17";;
*) echo "Undefined language"; exit;;
esac

# Set file paths for the required text files
destination_id_file="../java/tmp/destination_id.txt"
event_bus_arn_file="../java/tmp/event_bus_arn.txt"
random_suffix_file="../java/tmp/random_suffix.txt"
secrets_summary_file="../java/tmp/secrets-resource-summary.txt"
config_file="../../config/app-config.json"
config_json=$(jq -c '.' "${config_file}")
# Notification Type Definition file
notification_type_def_file="../../config/notification-type-definition.json"
notification_type_json=$(jq -c '.' "${notification_type_def_file}")
s3_record_file=".last_s3_key"

# Read the values from the files
destination_id=$(cat "$destination_id_file")
event_bus_arn=$(cat "$event_bus_arn_file")
random_suffix=$(cat "$random_suffix_file")
code_s3_key=$(cat "$s3_record_file")
stack_name=$(grep "^stack_name=" "$resources_file" | cut -d"=" -f2)
app_command=$(grep "^app_command=" "$resources_file" | cut -d"=" -f2)
cdk_deploy_output=$(grep "^cdk_deploy_output=" "$resources_file" | cut -d"=" -f2)
aws_account_id=$(grep "^aws_account_id=" "$resources_file" | cut -d"=" -f2)
aws_region=$(grep "^aws_region=" "$resources_file" | cut -d"=" -f2)
policy_arn=$(grep "^policy_arn=" "$resources_file" | cut -d"=" -f2)
bucket_name=$(grep "^bucket_name=" "$resources_file" | cut -d"=" -f2)
cdk_namespace=$(grep "^cdk_namespace=" "$resources_file" | cut -d"=" -f2)


echo "🧹 Starting cleanup..."
## 1. DELETE all the subscription and destinations
if [ -n "$random_suffix" ]; then
  unsubscribe_function="SPAPIUnsubscribeNotificationsLambdaFunction-${random_suffix}"
  echo "🗑️  Deleting subscriptions and destinations: $unsubscribe_function"
  aws lambda invoke \
    --function-name "$unsubscribe_function" \
    --payload '{"DeleteAll": true}' \
    --cli-binary-format raw-in-base64-out \
    /dev/stdout || echo "⚠️  Failed to invoke $unsubscribe_function"
fi

## 2. DESTROY CDK STACK
if [ -n "$stack_name" ]; then
  echo "🗑️  Destroying CDK stack: $stack_name"
  cdk destroy \
    --force --output "${cdk_deploy_output}" \
    --app "${app_command}" "${stack_name}" \
    -c RANDOM_SUFFIX="${random_suffix}" \
    -c CDK_QUALIFIER="${cdk_namespace}" \
    -c APP_CONFIG="${config_json}" \
    -c NOTIFICATION_TYPE_DEF_JSON="${notification_type_json}" \
    -c LAMBDA_CODE_S3_KEY="${code_s3_key}" \
    -c EVENT_BUS_ARN="${event_bus_arn}" \
    -c DESTINATION_ID="${destination_id}" \
    -c CHUNKED_SECRET_NAMES="${comma_separated}" \
    -c PROGRAMMING_LANGUAGE="${runtime}" || echo "⚠️  Failed to destroy CDK stack $stack_name"
fi

## 3. DELETE S3 BUCKET
if [ -n "$bucket_name" ]; then
  echo "🗑️  Deleting S3 bucket: $bucket_name"
  aws s3 rm "s3://${bucket_name}" --recursive >/dev/null 2>&1 || echo "⚠️  Failed to empty bucket $bucket_name or already empty"
  aws s3 rb "s3://${bucket_name}" --force || echo "⚠️  Failed to delete bucket $bucket_name"
fi

## 4. DELETE SECRETS FROM SECRETS MANAGER
echo "🔐 Deleting secrets from Secrets Manager..."
grep "^SecretARN_" "$secrets_summary_file" | cut -d"=" -f2 | while read -r secret_arn; do
  if [ -n "$secret_arn" ]; then
    echo "🗑️  Deleting secret: $secret_arn"
    aws secretsmanager delete-secret --secret-id "$secret_arn" --force-delete-without-recovery || echo "⚠️  Failed to delete secret $secret_arn"
  fi
done

## 5. DELETE IAM POLICY AND DETACH
if [ -n "$policy_arn" ]; then
  echo "🛡️  Deleting IAM policy: $policy_arn"
  role_name="cdk-${cdk_namespace}-cfn-exec-role-${aws_account_id}-${aws_region}"
  aws iam get-policy --policy-arn "$policy_arn" >/dev/null 2>&1 && \
  aws iam detach-role-policy --role-name "$role_name" --policy-arn "$policy_arn" || \
  echo "⚠️  Failed to detach policy from role $role_name"

  for version_id in $(aws iam list-policy-versions --policy-arn "$policy_arn" \
    --query 'Versions[?IsDefaultVersion==`false`].VersionId' --output text); do
    aws iam delete-policy-version --policy-arn "$policy_arn" --version-id "$version_id"
  done
  aws iam delete-policy --policy-arn "$policy_arn" || echo "⚠️  Failed to delete policy $policy_arn"
fi

## 6. DELETE LAMBDAS
echo "🗑️  Deleting Lambda functions..."
grep "^LambdaFunction_" "$secrets_summary_file" | cut -d"=" -f2 | while read -r lambda_function_name; do
  if [ -n "$lambda_function_name" ]; then
    echo "🗑️  Deleting Lambda function: $lambda_function_name"
    aws lambda delete-function --function-name "$lambda_function_name" || echo "⚠️  Failed to delete Lambda function $lambda_function_name"
  fi
done

## 7. DELETE EVENTBRIDGE RULES AND TARGETS
rule_name="SPAPIEventBridgeRule-${random_suffix}"
echo "🗑️  Deleting EventBridge rule and targets: $rule_name"
targets=$(aws events list-targets-by-rule --rule "$rule_name" --query 'Targets[*].Id' --output text 2>/dev/null || echo "")

if [ -n "$targets" ]; then
  for target_id in $targets; do
    aws events remove-targets --rule "$rule_name" --ids "$target_id" || echo "⚠️  Failed to remove target $target_id from rule $rule_name"
  done
fi

aws events delete-rule --name "$rule_name" || echo "⚠️  Failed to delete EventBridge rule $rule_name"

## 8. DELETE EVENTBRIDGE EVENT BUS (best-effort)
if [ -n "$event_bus_arn" ]; then
  event_bus_name=$(basename "$event_bus_arn")
  echo "🗑️  Attempting to delete EventBridge event bus: $event_bus_name"

  aws events delete-event-bus --name "$event_bus_name" --region "$aws_region"
  if [ $? -eq 0 ]; then
    echo "✅ Deleted EventBridge event bus: $event_bus_name"
  else
    echo "⚠️ Could not delete EventBridge event bus: $event_bus_name"
    echo "   ℹ️ Partner EventBridge event buses (aws.partner/...) can often only be deleted from the AWS Console."
    echo "   👉 Please go to the AWS Console > EventBridge > Event Buses, and delete it manually if needed."
    echo "      https://console.aws.amazon.com/events/home?region=${aws_region}#/event-buses"
  fi
fi



## 9. DELETE RESOURCE FILES
#echo "🧾 Deleting resource summary files"
rm -f "$resources_file"
rm -f "$secrets_summary_file"
rm -f "$destination_id_file"
rm -f "$event_bus_arn_file"
rm -f "$random_suffix_file"
rm -f "$s3_record_file"

echo "✅ Cleanup complete."