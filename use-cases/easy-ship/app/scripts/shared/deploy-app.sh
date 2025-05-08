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
  javascript) runtime="nodejs18.x";;
  python) runtime="python3.8";;
  csharp) runtime="dotnet6";;
  php) runtime="provided.al2";;
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
  echo "Bootstrapping CDK environment failed."
  echo "Aborting"
  exit -1
fi

# Create the S3 bucket to host Java code
echo "Creating S3 bucket"
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
  create_scheduled_package_handler="lambda.CreateScheduledPackageHandler"
  get_feed_document_handler="lambda.GetFeedDocumentHandler"
  get_report_document_handler="lambda.GetReportDocumentHandler"
  get_scheduled_package_handler="lambda.GetScheduledPackageHandler"
  inventory_check_handler="lambda.InventoryCheckHandler"
  list_handover_slots_handler="lambda.ListHandoverSlotsHandler"
  process_notification_handler="lambda.ProcessNotificationHandler"
  retrieve_order_handler="lambda.RetrieveOrderHandler"
  submit_feed_request_handler="lambda.SubmitFeedRequestHandler"
  subscribe_notifications_handler="lambda.SubscribeNotificationsHandler"
  redirect_handler="lambda.UrlRedirectHandler"
  mvn validate -f "${java_code_folder}pom.xml"
  mvn package -f "${java_code_folder}pom.xml"
  aws s3 cp "${java_code_folder}${java_code_jar}" "s3://${bucket_name}/${code_s3_key}"
fi

if [ "$language" == "php" ]; then
  echo "Packaging and uploading PHP code"

  php_code_folder="../../../code/php/"
  php_lambda_folder="../../../code/php/lambda/"
  php_code_zip="php-lambda-function.zip"
  code_s3_key="src/php-lambda-function.zip"

  # Map with PHP handler
  create_scheduled_package_handler="lambda/CreateScheduledPackageHandler.php"
  get_feed_document_handler="lambda/GetFeedDocumentHandler.php"
  get_report_document_handler="lambda/GetReportDocumentHandler.php"
  get_scheduled_package_handler="lambda/GetScheduledPackageHandler.php"
  inventory_check_handler="lambda/InventoryCheckHandler.php"
  list_handover_slots_handler="lambda/ListHandoverSlotsHandler.php"
  process_notification_handler="lambda/ProcessNotificationHandler.php"
  retrieve_order_handler="lambda/RetrieveOrderHandler.php"
  submit_feed_request_handler="lambda/SubmitFeedRequestHandler.php"
  subscribe_notifications_handler="lambda/SubscribeNotificationsHandler.php"
  redirect_handler="lambda/UrlRedirectHandler.php"

  # Ensure the directories exist
  mkdir -p "${php_lambda_folder}"

  # **Ensure index.php is executable**
  if [ -f "${php_lambda_folder}/index.php" ]; then
    chmod +x "${php_lambda_folder}/index.php"
    echo "Set execute permission on index.php"
  else
    echo "Warning: index.php not found in ${php_lambda_folder}"
  fi

  # Package Lambda function
  echo "Creating ZIP package..."
  cd "${php_code_folder}"
  zip -r "${php_code_zip}" index.php lambda/ vendor/ -x "bin/*"
  cd -  # Return to the original directory

  # **Upload to S3 before CDK deployment**
  echo "Uploading PHP Lambda package to S3..."
  aws s3 cp "${php_code_folder}${php_code_zip}" "s3://${bucket_name}/${code_s3_key}"
  if [ $? -ne 0 ]; then
    echo "Error: Uploading PHP Lambda package to S3 failed!" >&2
    exit 1
  fi

  echo "Successfully uploaded PHP Lambda package to S3: s3://${bucket_name}/${code_s3_key}"
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

# Retrieve config values
config_file="../../app.config"
sp_api_client_id="$(grep "^ClientId=" "${config_file}" | cut -d"=" -f2)"
sp_api_client_secret="$(grep "^ClientSecret=" "${config_file}" | cut -d"=" -f2)"
refresh_token="$(grep "^RefreshToken=" "${config_file}" | cut -d"=" -f2)"
region_code="$(grep "^RegionCode=" "${config_file}" | cut -d"=" -f2)"
sp_api_email="$(grep "^NotificationEmail=" "${config_file}" | cut -d"=" -f2)"


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
  -c LANGUAGE="${language}" \
  --parameters accessKey="${sp_api_access_key}" \
  --parameters secretKey="${sp_api_secret_key}" \
  --parameters clientID="${sp_api_client_id}" \
  --parameters clientSecret="${sp_api_client_secret}" \
  --parameters refreshToken="${refresh_token}" \
  --parameters regionCode="${region_code}"\
  --parameters notificationEmail="${sp_api_email}" \
  --parameters roleARN="${sp_api_role_arn}" \
  --parameters programmingLanguage="${runtime}" \
  --parameters easyShipCreateScheduledPackageLambdaFunctionHandler="${create_scheduled_package_handler}" \
  --parameters easyShipGetFeedDocumentLambdaFunctionHandler="${get_feed_document_handler}" \
  --parameters easyShipGetReportDocumentLambdaFunctionHandler="${get_report_document_handler}" \
  --parameters easyShipGetScheduledPackageLambdaFunctionHandler="${get_scheduled_package_handler}" \
  --parameters easyShipInventoryCheckLambdaFunctionHandler="${inventory_check_handler}" \
  --parameters easyShipListHandoverSlotsLambdaFunctionHandler="${list_handover_slots_handler}" \
  --parameters easyShipProcessNotificationLambdaFunctionHandler="${process_notification_handler}" \
  --parameters easyShipRetrieveOrderLambdaFunctionHandler="${retrieve_order_handler}" \
  --parameters easyShipSubmitFeedRequestLambdaFunctionHandler="${submit_feed_request_handler}" \
  --parameters easyShipSubscribeNotificationsLambdaFunctionHandler="${subscribe_notifications_handler}" \
  --parameters easyShipUrlRedirectLambdaFunctionHandler="${redirect_handler}" \
  --parameters artifactsS3BucketName="${bucket_name}" \
  --parameters lambdaFunctionsCodeS3Key="${code_s3_key}" \
  --parameters stepFunctionStateMachineDefinitionS3Key="${state_machine_s3_key}"

if [ $? -ne 0 ]
then
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
exec 3>&-

echo "Successfully created an SP-API app"