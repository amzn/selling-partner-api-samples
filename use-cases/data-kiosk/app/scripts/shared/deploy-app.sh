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
  python) runtime="python3.8";;
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
  echo "Bootstrapping CDK environment failed."
  echo "Aborting"
  exit -1
fi

# Create the S3 bucket to host application code
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

# If it's a Python app, package the code and upload it to S3
if [ "$language" == "python" ]; then
  echo "Packaging and uploading Python code"
  python_code_folder="../../../code/python/"

  # Ensure the target directory is clean
  if [ -d "${python_code_folder}target" ]; then
      rm -r "${python_code_folder}target"
  fi
  mkdir "${python_code_folder}target"

  python_code_zip="target/sp-api-python-app-1.0-upload.zip"
  code_s3_key="src/sp-api-python-app.zip"
  process_notification_handler="process_notification_handler.lambda_handler"
  subscribe_notifications_handler="subscribe_notifications_handler.lambda_handler"
  create_query_handler="create_query_handler.lambda_handler"
  create_schedule_handler="create_schedule_handler.lambda_handler"
  delete_schedule_handler="delete_schedule_handler.lambda_handler"
  format_schedule_handler="format_schedule_handler.lambda_handler"
  cancel_query_handler="cancel_query_handler.lambda_handler"
  get_document_handler="get_document_handler.lambda_handler"
  store_document_handler="store_document_handler.lambda_handler"

  # Function to find the correct pip command
  find_pip() {
    if command -v pip >/dev/null 2>&1; then
      echo "pip"
    elif command -v pip3 >/dev/null 2>&1; then
      echo "pip3"
    else
      echo "No pip found"
      exit 1
    fi
  }

  pip_cmd=$(find_pip)
  echo "Using $pip_cmd for installation"

  (
    # Change to the source directory
    cd "${python_code_folder}src" || { echo "Failed to change directory"; exit 1; }
    echo "Changed directory to $(pwd)"

    # Create package directory
    mkdir -p package
    echo "Created package directory"

    # Install dependencies
    echo "Installing dependencies"
    $pip_cmd install --target ./package graphql-core
    if [ $? -ne 0 ]; then
      echo "$pip_cmd install failed"
      exit 1
    fi

    # Zip the installed dependencies and the function code
    if command -v zip >/dev/null 2>&1; then
      echo "Zipping files with zip"
      zip -rq "${python_code_folder}${python_code_zip}" .
    elif [[ "$OSTYPE" == "msys"* ]]; then
      echo "Zipping files with powershell"
      powershell -Command "Compress-Archive -Path '.' -DestinationPath '${python_code_folder}${python_code_zip}'"
    fi
  )

  # Upload to S3
  echo "Uploading zip to S3"
  aws s3 cp "${python_code_folder}${python_code_zip}" "s3://${bucket_name}/${code_s3_key}"
  if [ $? -ne 0 ]; then
    echo "S3 upload failed"
    exit 1
  fi
  echo "Upload successful"

elif [ "$language" == "java" ]; then
  echo "Packaging and uploading Java code"
  java_code_folder="../../../code/java/"
  java_code_jar="target/sp-api-java-app-1.0.jar"
  code_s3_key="src/sp-api-java-app.jar"
  process_notification_handler="lambda.ProcessNotificationHandler"
  subscribe_notifications_handler="lambda.SubscribeNotificationHandler"
  create_query_handler="lambda.CreateQueryHandler"
  cancel_query_handler="lambda.CancelQueryHandler"
  get_document_handler="lambda.GetDocumentHandler"
  store_document_handler="lambda.StoreDocumentHandler"
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

# Retrieve config values
config_file="../../app.config"
sp_api_client_id="$(grep "^ClientId=" "${config_file}" | cut -d"=" -f2)"
sp_api_client_secret="$(grep "^ClientSecret=" "${config_file}" | cut -d"=" -f2)"
refresh_token="$(grep "^RefreshToken=" "${config_file}" | cut -d"=" -f2)"
region_code="$(grep "^RegionCode=" "${config_file}" | cut -d"=" -f2)"

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
  --parameters clientId="${sp_api_client_id}" \
  --parameters clientSecret="${sp_api_client_secret}" \
  --parameters refreshToken="${refresh_token}" \
  --parameters regionCode="${region_code}" \
  --parameters programmingLanguage="${runtime}" \
  --parameters artifactsS3BucketName="${bucket_name}" \
  --parameters lambdaFunctionsCodeS3Key="${code_s3_key}" \
  --parameters spapiCreateQueryLambdaFunctionHandler="${create_query_handler}" \
  --parameters spapiCreateScheduleLambdaFunctionHandler="${create_schedule_handler}" \
  --parameters spapiDeleteScheduleLambdaFunctionHandler="${delete_schedule_handler}" \
  --parameters spapiFormatScheduleLambdaFunctionHandler="${format_schedule_handler}" \
  --parameters spapiCancelQueryLambdaFunctionHandler="${cancel_query_handler}" \
  --parameters spapiGetDocumentLambdaFunctionHandler="${get_document_handler}" \
  --parameters spapiStoreDocumentLambdaFunctionHandler="${store_document_handler}" \
  --parameters spapiProcessNotificationLambdaFunctionHandler="${process_notification_handler}" \
  --parameters spapiSubscribeNotificationsLambdaFunctionHandler="${subscribe_notifications_handler}" \
  --parameters stepFunctionsStateMachineDefinitionS3Key="${state_machine_s3_key}"
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
