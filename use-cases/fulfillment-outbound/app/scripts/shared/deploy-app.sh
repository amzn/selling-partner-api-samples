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
  java) runtime="java11";;
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
random_string=$(LC_ALL=C tr -dc 'a-z' < /dev/urandom | fold -w 6 | head -n 1)

# Create an IAM user with required permissions to generate the CloudFormation stack
echo "Creating IAM user"
user_name="sp-api-app-user-${random_string}"
aws iam create-user --user-name ${user_name}
if [ $? -ne 0 ]
then
  echo "IAM user creation failed"
  echo "Aborting"
  exit -1
fi

# Sleeping to propagate changes
echo "Processing ..."
sleep 30

# Create and attach the IAM policy
echo "Creating IAM policy"
policy_arn=$(aws iam create-policy --policy-name "sp-api-app-policy-${random_string}" --policy-document file://../iam-policy.json --query "Policy.Arn" --output text)
aws iam attach-user-policy --user-name "${user_name}" --policy-arn ${policy_arn}
if [ $? -ne 0 ]
then
  echo "IAM policy creation failed"
  echo "Aborting"
  exit -1
fi

# Sleeping to propagate changes
echo "Processing ..."
sleep 30

# Create access key and secret key for the IAM user
echo "Creating IAM keys"
secret=$(aws iam create-access-key --user-name ${user_name} --query 'AccessKey.[AccessKeyId,SecretAccessKey]' --output text)
access_key=$(echo ${secret} | awk '{print $1}')
secret_key=$(echo ${secret} | awk '{print $2}')

# Sleeping to propagate changes
echo "Processing ..."
sleep 30

# Create the S3 bucket to host Java code
echo "Creating S3 resources"
bucket_name="sp-api-app-bucket-${random_string}"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 mb "s3://${bucket_name}"
if [ $? -ne 0 ]
then
  echo "S3 bucket creation failed"
  echo "Aborting"
  exit -1
fi

# Sleeping to propagate changes
echo "Processing ..."
sleep 30

# If it's a Java app, package the code and upload it to S3
if [ "$language" == "java" ]; then
  echo "Packaging and uploading Java code"
  java_code_folder="../../../code/java/"
  java_code_jar="target/sp-api-java-app-1.0.jar"
  code_s3_key="src/sp-api-java-app.jar"
  cancel_order_handler="lambda.CancelOrderHandler"
  create_order_handler="lambda.CreateOrderHandler"
  get_order_handler="lambda.GetOrderHandler"
  get_package_tracking_details_handler="lambda.GetPackageTrackingDetailsHandler"
  get_order_tracking_details_handler="lambda.GetOrderTrackingDetailsHandler"
  preview_order_handler="lambda.PreviewOrderHandler"
  process_cancel_notification_handler="lambda.ProcessCancelNotificationHandler"
  process_notification_handler="lambda.ProcessNotificationHandler"
  process_tracking_details_notification_handler="lambda.ProcessTrackingDetailsNotificationHandler"
  subscribe_notifications_handler="lambda.SubscribeNotificationsHandler"
  update_order_handler="lambda.UpdateOrderHandler"
  mvn validate -f "${java_code_folder}pom.xml"
  mvn package -f "${java_code_folder}pom.xml"
  AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
    aws s3 cp "${java_code_folder}${java_code_jar}" "s3://${bucket_name}/${code_s3_key}"
fi

# Upload the StepFunctions state machine definition to S3
state_machine_s3_key="step-functions/state-machine-definition.json"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 cp ../../step-functions/step-functions-workflow-definition.json "s3://${bucket_name}/${state_machine_s3_key}"
if [ $? -ne 0 ]
then
  echo "State machine definition upload to S3 failed"
  echo "Aborting"
  exit -1
fi

# Upload the PackageTrackingStepFunctions state machine definition to S3
state_machine_tracking_details_s3_key="step-functions/state-machine-tracking-details-definition.json"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 cp ../../step-functions/step-functions-tracking-details-workflow-definition.json "s3://${bucket_name}/${state_machine_tracking_details_s3_key}"
if [ $? -ne 0 ]
then
  echo "State machine package tracking definition upload to S3 failed"
  echo "Aborting"
  exit -1
fi

# Upload the CancelStepFunctions state machine definition to S3
state_machine_cancel_s3_key="step-functions/state-machine-cancel-definition.json"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 cp ../../step-functions/step-functions-cancel-workflow-definition.json "s3://${bucket_name}/${state_machine_cancel_s3_key}"
if [ $? -ne 0 ]
then
  echo "State machine cancel definition upload to S3 failed"
  echo "Aborting"
  exit -1
fi

# Retrieve config values
config_file="../../app.config"
sp_api_client_id="$(grep "^ClientId=" "${config_file}" | cut -d"=" -f2)"
sp_api_client_secret="$(grep "^ClientSecret=" "${config_file}" | cut -d"=" -f2)"
sp_api_refresh_token="$(grep "^RefreshToken=" "${config_file}" | cut -d"=" -f2)"
sp_api_region_code="$(grep "^RegionCode=" "${config_file}" | cut -d"=" -f2)"

# Create the CloudFormation stack
echo "Creating CloudFormation stack"
stack_name="sp-api-app-${random_string}"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws cloudformation create-stack \
    --stack-name "${stack_name}" \
    --template-body file://../../app-template.yaml \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameters \
      ParameterKey="ClientId",ParameterValue="${sp_api_client_id}" \
      ParameterKey="ClientSecret",ParameterValue="${sp_api_client_secret}" \
      ParameterKey="RefreshToken",ParameterValue="${sp_api_refresh_token}" \
      ParameterKey="RegionCode",ParameterValue="${sp_api_region_code}" \
      ParameterKey="ProgrammingLanguage",ParameterValue="${runtime}" \
      ParameterKey="RandomSuffix",ParameterValue="${random_string}" \
      ParameterKey="ArtifactsS3BucketName",ParameterValue="${bucket_name}" \
      ParameterKey="LambdaFunctionsCodeS3Key",ParameterValue="${code_s3_key}" \
      ParameterKey="SPAPICancelOrderLambdaFunctionHandler",ParameterValue="${cancel_order_handler}" \
      ParameterKey="SPAPICreateOrderLambdaFunctionHandler",ParameterValue="${create_order_handler}" \
      ParameterKey="SPAPIGetOrderLambdaFunctionHandler",ParameterValue="${get_order_handler}" \
      ParameterKey="SPAPIGetPackageTrackingDetailsLambdaFunctionHandler",ParameterValue="${get_package_tracking_details_handler}" \
      ParameterKey="SPAPIGetOrderTrackingDetailsLambdaFunctionHandler",ParameterValue="${get_order_tracking_details_handler}" \
      ParameterKey="SPAPIPreviewOrderLambdaFunctionHandler",ParameterValue="${preview_order_handler}" \
      ParameterKey="SPAPIProcessCancelNotificationLambdaFunctionHandler",ParameterValue="${process_cancel_notification_handler}" \
      ParameterKey="SPAPIProcessNotificationLambdaFunctionHandler",ParameterValue="${process_notification_handler}" \
      ParameterKey="SPAPIProcessTrackingDetailsNotificationLambdaFunctionHandler",ParameterValue="${process_tracking_details_notification_handler}" \
      ParameterKey="SPAPISubscribeNotificationsLambdaFunctionHandler",ParameterValue="${subscribe_notifications_handler}" \
      ParameterKey="SPAPIUpdateOrderLambdaFunctionHandler",ParameterValue="${update_order_handler}" \
      ParameterKey="StepFunctionsStateMachineDefinitionS3Key",ParameterValue="${state_machine_s3_key}" \
      ParameterKey="StepFunctionsStateMachineCancelDefinitionS3Key",ParameterValue="${state_machine_cancel_s3_key}" \
      ParameterKey="StepFunctionsStateMachineTrackingDetailsDefinitionS3Key",ParameterValue="${state_machine_tracking_details_s3_key}"
if [ $? -ne 0 ]
then
  echo "CloudFormation stack creation failed"
  echo "Aborting"
  exit -1
fi
echo "CloudFormation stack name = ${stack_name}"

outbound_bucket_name="sp-api-labels-s3-bucket-${random_string}"

# Store resources' IDs in a tmp file for future clean-up
echo "Storing resources' IDs in a tmp file"
tempdir="tmp"
if [ ! -d "$tempdir" ]; then
  mkdir "$tempdir"
fi
filename="tmp/resources.txt"
exec 3<> "$filename"
echo "user_name=$user_name" >&3
echo "policy_arn=$policy_arn" >&3
echo "access_key=$access_key" >&3
echo "secret_key=$secret_key" >&3
echo "bucket_name=$bucket_name" >&3
echo "outbound_bucket_name=$outbound_bucket_name" >&3
echo "stack_name=$stack_name" >&3
exec 3>&-

echo "Successfully created a Fulfillment Outbound SP-API app"