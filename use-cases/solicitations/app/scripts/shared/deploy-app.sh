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
  csharp) runtime="dotnet6";;
*) echo "Undefined language"; exit;;
esac

# Verify pre-requisites
bash ../shared/pre-requisites.sh "$@"
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

# Create the S3 bucket to host application code
echo "Creating S3 bucket"
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

# If it's a Python app, package the code and upload it to S3
if [ "$language" == "python" ]; then
  echo "Packaging and uploading Python code"
  python_code_folder="../../../code/python/"
  if [ -d "${python_code_folder}target" ]; then
      rm -r "${python_code_folder}target"
  fi
  mkdir "${python_code_folder}target"
  python_code_zip="target/sp-api-python-app-1.0-upload.zip"
  code_s3_key="src/sp-api-python-app.zip"
  solicitation_scheduler_handler="solicitation_scheduler_handler.lambda_handler"
  get_solicitation_actions_handler="get_solicitation_actions_handler.lambda_handler"
  submit_solicitation_handler="submit_solicitation_handler.lambda_handler"
  subscribe_notifications_handler="subscribe_notifications_handler.lambda_handler"
  (
    cd "${python_code_folder}src" || exit
    zip -rq "${python_code_folder}${python_code_zip}" .
  )
  AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
    aws s3 cp "${python_code_folder}${python_code_zip}" "s3://${bucket_name}/${code_s3_key}"
# If it's a C# app, package the code and upload it to S3
elif [ "$language" == "csharp" ]; then
  echo "Packaging and uploading CSharp code"
  csharp_code_folder="../../../code/csharp/"
  if [ ! -d "${csharp_code_folder}target" ]; then
    mkdir "${csharp_code_folder}target"
  fi
  csharp_code_zip="target/sp-api-csharp-app-1.0-upload.zip"
  code_s3_key="src/sp-api-csharp-app.zip"
  csharp_package_name="sp-api-csharp-app-1.0-upload"
  solicitation_scheduler_handler="SpApiCsharpApp::SpApiCsharpApp.SolicitationSchedulerHandler::FunctionHandlerAsync"
  get_solicitation_actions_handler="SpApiCsharpApp::SpApiCsharpApp.GetSolictitationActionsHandler::FunctionHandlerAsync"
  submit_solicitation_handler="SpApiCsharpApp::SpApiCsharpApp.SubmitSolictitationHandler::FunctionHandler"
  subscribe_notifications_handler="SpApiCsharpApp::SpApiCsharpApp.SubscribeNotificationsHandler::FunctionHandler"
  (
    cd "${csharp_code_folder}src/sp-api-csharp-app" || exit
    dotnet lambda package $csharp_package_name -o "../../${csharp_code_zip}" .
  )
  AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
    aws s3 cp "${csharp_code_folder}${csharp_code_zip}" "s3://${bucket_name}/${code_s3_key}"
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

# Retrieve config values
config_file="../../app.config"
sp_api_client_id="$(grep "^ClientId=" "${config_file}" | cut -d"=" -f2)"
sp_api_client_secret="$(grep "^ClientSecret=" "${config_file}" | cut -d"=" -f2)"
refresh_token="$(grep "^RefreshToken=" "${config_file}" | cut -d"=" -f2)"

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
      ParameterKey="RefreshToken",ParameterValue="${refresh_token}" \
      ParameterKey="ProgrammingLanguage",ParameterValue="${runtime}" \
      ParameterKey="RandomSuffix",ParameterValue="${random_string}" \
      ParameterKey="ArtifactsS3BucketName",ParameterValue="${bucket_name}" \
      ParameterKey="LambdaFunctionsCodeS3Key",ParameterValue="${code_s3_key}" \
      ParameterKey="SPAPISolicitationSchedulerHandler",ParameterValue="${solicitation_scheduler_handler}" \
      ParameterKey="SPAPIGetSolicitationActionsHandler",ParameterValue="${get_solicitation_actions_handler}" \
      ParameterKey="SPAPISubmitSolicitationHandler",ParameterValue="${submit_solicitation_handler}" \
      ParameterKey="SPAPISubscribeNotificationsHandler",ParameterValue="${subscribe_notifications_handler}" \
      ParameterKey="StepFunctionsStateMachineDefinitionS3Key",ParameterValue="${state_machine_s3_key}"
if [ $? -ne 0 ]
then
  echo "CloudFormation stack creation failed"
  echo "Aborting"
  exit -1
fi
echo "CloudFormation stack name = ${stack_name}"

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
echo "stack_name=$stack_name" >&3
exec 3>&-

echo "Successfully created an SP-API app"