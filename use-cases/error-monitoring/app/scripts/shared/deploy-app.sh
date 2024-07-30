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
  error_monitoring_lambda_handler="lambda.ErrorMonitoringHandler"
  mvn validate -f "${java_code_folder}pom.xml"
  mvn package -f "${java_code_folder}pom.xml"
aws s3 cp "${java_code_folder}${java_code_jar}" "s3://${bucket_name}/${code_s3_key}"
# If it's a Javascript app, package the code and upload it to S3
elif [ "$language" == "javascript" ]; then
  echo "Packaging and uploading JavaScript code"
  js_code_folder="../../../code/javascript/"
  if [ ! -d "${js_code_folder}target" ]; then
    mkdir "${js_code_folder}target"
  fi
  js_code_zip="target/sp-api-javascript-app-1.0-upload.zip"
  code_s3_key="src/sp-api-javascript-app.zip"
  lambda_func_handler="index.handler"
  (
    cd "${js_code_folder}src" || exit
    if command -v zip >/dev/null 2>&1; then
      zip -rq "${js_code_folder}${js_code_zip}" .
    elif [[ "$OSTYPE" == "msys"* ]]; then
      powershell -Command "Compress-Archive -Path '.' -DestinationPath '${js_code_folder}${js_code_zip}'"
    fi
  )
  aws s3 cp "${js_code_folder}${js_code_zip}" "s3://${bucket_name}/${code_s3_key}"

# If it's a Python app, package the code and upload it to S3
elif [ "$language" == "python" ]; then
	echo "Packaging and uploading Python code"
	python_code_folder="../../../code/python/"
	if [ -d "${python_code_folder}target" ]; then
	    rm -r "${python_code_folder}target"
	fi
	mkdir "${python_code_folder}target"
	python_code_zip="target/sp-api-python-app-1.0-upload.zip"
	code_s3_key="src/sp-api-python-app.zip"
  error_monitoring_lambda_handler="src/error_monitoring_lambda_handler.lambda_handler"
	(
    cd "${python_code_folder}" || exit
    if command -v zip >/dev/null 2>&1; then
      zip -rq "${python_code_zip}" . -x "target/"
    elif [[ "$OSTYPE" == "msys"* ]]; then
      powershell -Command "\$filestoArchive = Get-ChildItem -Path . -Exclude 'target'; Compress-Archive -Path \$filesToArchive -DestinationPath '${python_code_zip}'"
    fi
  )
	aws s3 cp "${python_code_folder}${python_code_zip}" "s3://${bucket_name}/${code_s3_key}"

elif [ "$language" == "csharp" ]; then
  echo "Packaging and uploading CSharp code"
  csharp_code_folder="../../../code/csharp/"
  if [ ! -d "${csharp_code_folder}target" ]; then
    mkdir "${csharp_code_folder}target"
  fi
  csharp_code_zip="target/sp-api-csharp-app-1.0-upload.zip"
  code_s3_key="src/sp-api-csharp-app.zip"
  csharp_package_name="sp-api-csharp-app-1.0-upload"
  lambda_func_handler="spApiCsharpApp::spApiCsharpApp.dummyLambdaHandler::functionHandler"
  (
    cd "${csharp_code_folder}src/sp-api-csharp-app" || exit
    dotnet lambda package $csharp_package_name -o "../../${csharp_code_zip}" .
  )
  aws s3 cp "${csharp_code_folder}${csharp_code_zip}" "s3://${bucket_name}/${code_s3_key}"
fi


# Retrieve config values
config_file="../../app.config"
sp_api_client_id="$(grep "^ClientId=" "${config_file}" | cut -d"=" -f2)"
sp_api_client_secret="$(grep "^ClientSecret=" "${config_file}" | cut -d"=" -f2)"
refresh_token="$(grep "^RefreshToken=" "${config_file}" | cut -d"=" -f2)"
email_id="$(grep "^EmailId=" "${config_file}" | cut -d"=" -f2)"
schedule="$(grep "^Schedule=" "${config_file}" | cut -d"=" -f2)"

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
  --parameters refreshToken="${refresh_token}" \
  --parameters clientId="${sp_api_client_id}" \
  --parameters clientSecret="${sp_api_client_secret}" \
  --parameters emailId="${email_id}" \
  --parameters schedule="${schedule}" \
  --parameters programmingLanguage="${runtime}" \
  --parameters lambdaFunctionHandler="${error_monitoring_lambda_handler}" \
  --parameters artifactS3BucketName="${bucket_name}" \
  --parameters lambdaFunctionCodeS3Key="${code_s3_key}"
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