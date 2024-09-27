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

# Create and attach the IAM policy
echo "Creating IAM policy"
policy_arn=$(aws iam create-policy --policy-name "sp-api-app-policy-${random_string}" --policy-document file://../iam-policy.json --query "Policy.Arn" --output text)
if [ $? -ne 0 ]
then
  echo "IAM policy creation failed"
  echo "Aborting"
  exit -1
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
  echo "Bootstrapping CDK environment failed"
  echo "Aborting"
  exit -1
fi

# Create the S3 bucket to host Java code
echo "Creating S3 resources"
bucket_name="sp-api-app-bucket-${random_string}"
aws s3 mb "s3://${bucket_name}"
if [ $? -ne 0 ]
then
  echo "S3 bucket creation failed"
  echo "Aborting"
  exit -1
fi

# Sleeping to propagate changes
echo "Processing ..."
sleep 15

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
  aws s3 cp "${java_code_folder}${java_code_jar}" "s3://${bucket_name}/${code_s3_key}"
fi

# Upload the StepFunctions state machine definition to S3
state_machine_s3_key="step-functions/state-machine-definition.json"
aws s3 cp ../../step-functions/step-functions-workflow-definition.json "s3://${bucket_name}/${state_machine_s3_key}"
if [ $? -ne 0 ]
then
  echo "State machine definition upload to S3 failed"
  echo "Aborting"
  exit -1
fi

# Upload the PackageTrackingStepFunctions state machine definition to S3
state_machine_tracking_details_s3_key="step-functions/state-machine-tracking-details-definition.json"
aws s3 cp ../../step-functions/step-functions-tracking-details-workflow-definition.json "s3://${bucket_name}/${state_machine_tracking_details_s3_key}"
if [ $? -ne 0 ]
then
  echo "State machine package tracking definition upload to S3 failed"
  echo "Aborting"
  exit -1
fi

# Upload the CancelStepFunctions state machine definition to S3
state_machine_cancel_s3_key="step-functions/state-machine-cancel-definition.json"
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

# Deploy the CDK stack
echo "Creating CDK stack..."
cdk deploy "${stack_name}" --output "${cdk_deploy_output}" --app "${app_command}" --require-approval never \
  -c RANDOM_SUFFIX="${random_string}" \
  -c CDK_QUALIFIER="${cdk_namespace}" \
  --parameters refreshToken="${sp_api_refresh_token}" \
  --parameters clientId="${sp_api_client_id}" \
  --parameters clientSecret="${sp_api_client_secret}" \
  --parameters programmingLanguage="${runtime}" \
  --parameters artifactsS3BucketName="${bucket_name}" \
  --parameters lambdaFunctionsCodeS3Key="${code_s3_key}" \
  --parameters regionCode="${sp_api_region_code}" \
  --parameters stepFunctionsStateMachineDefinitionS3Key="${state_machine_s3_key}" \
  --parameters cancelOrderLambdaFunctionHandler="${cancel_order_handler}" \
  --parameters createOrderLambdaFunctionHandler="${create_order_handler}" \
  --parameters getOrderLambdaFunctionHandler="${get_order_handler}" \
  --parameters getOrderTrackingDetailsLambdaFunctionHandler="${get_order_tracking_details_handler}" \
  --parameters getPackageTrackingDetailsLambdaFunctionHandler="${get_package_tracking_details_handler}" \
  --parameters previewOrderLambdaFunctionHandler="${preview_order_handler}" \
  --parameters processCancelNotificationLambdaFunctionHandler="${process_cancel_notification_handler}" \
  --parameters processNotificationLambdaFunctionHandler="${process_notification_handler}" \
  --parameters processTrackingDetailsNotificationLambdaFunctionHandler="${process_tracking_details_notification_handler}" \
  --parameters subscribeNotificationsLambdaFunctionHandler="${subscribe_notifications_handler}" \
  --parameters updateOrderLambdaFunctionHandler="${update_order_handler}" \
  --parameters stepFunctionsStateMachineCancelDefinitionS3Key="${state_machine_cancel_s3_key}" \
  --parameters stepFunctionsStateMachineTrackingDetailsDefinitionS3Key="${state_machine_tracking_details_s3_key}"
if [ $? -ne 0 ]
then
  echo "CDK stack creation failed"
  echo "Aborting"
  exit -1
fi

outbound_bucket_name="sp-api-labels-s3-bucket-${random_string}"

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
echo "outbound_bucket_name=$outbound_bucket_name" >&3
echo "stack_name=$stack_name" >&3
echo "cdk_deploy_output=$cdk_deploy_output" >&3
echo "random_suffix=$random_string" >&3
echo "aws_account_id=$aws_account_id" >&3
echo "aws_region=$aws_region" >&3
echo "cdk_namespace=$cdk_namespace" >&3
exec 3>&-

echo "Successfully created a Fulfillment Outbound SP-API app"
