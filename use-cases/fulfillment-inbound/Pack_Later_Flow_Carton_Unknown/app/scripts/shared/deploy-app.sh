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

# Create the S3 bucket to host Java code
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

# If it's a Java app, package the code and upload it to S3
if [ "$language" == "java" ]; then
  echo "Packaging and uploading Java code"
  java_code_folder="../../../code/java/"
  java_code_jar="target/sp-api-java-app-1.0.jar"
  code_s3_key="src/sp-api-java-app.jar"
  create_inbound_plan_func_handler="lambda.CreateInboundPlanLambdaHandler"
  operation_status_func_handler="lambda.OperationStatusLambdaHandler"
  set_packing_information_func_handler="lambda.SetPackingInformationLambdaHandler"
  generate_placement_options_func_handler="lambda.GeneratePlacementOptionsLambdaHandler"
  list_placement_options_func_handler="lambda.ListPlacementOptionsLambdaHandler"
  generate_transportation_options_func_handler="lambda.GenerateTransportationOptionsLambdaHandler"
  generate_delivery_window_options_func_handler="lambda.GenerateDeliveryWindowOptionsLambdaHandler"
  list_transportation_options_func_handler="lambda.ListTransportationOptionsLambdaHandler"
  list_delivery_window_options_func_handler="lambda.ListDeliveryWindowOptionsLambdaHandler"
  confirm_placement_option_func_handler="lambda.ConfirmPlacementOptionLambdaHandler"
  confirm_delivery_window_options_func_handler="lambda.ConfirmDeliveryWindowOptionsLambdaHandler"
  confirm_transportation_options_func_handler="lambda.ConfirmTransportationOptionsLambdaHandler"
  get_shipment_func_handler="lambda.GetShipmentLambdaHandler"
  get_labels_func_handler="lambda.GetLabelsLambdaHandler"
  update_shipment_tracking_details_handler="lambda.UpdateShipmentTrackingDetailsLambdaHandler"
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

# Upload the Update Shipment Tracking StepFunctions state machine definition to S3
state_machine_tracking_details_s3_key="step-functions/step-functions-updateShipmentTracking-workflow-definition.json"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 cp ../../step-functions/step-functions-updateShipmentTracking-workflow-definition.json "s3://${bucket_name}/${state_machine_tracking_details_s3_key}"
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
notification_email="$(grep "^Email=" "${config_file}" | cut -d"=" -f2)"

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
      ParameterKey="ProgrammingLanguage",ParameterValue="${runtime}" \
      ParameterKey="RandomSuffix",ParameterValue="${random_string}" \
      ParameterKey="ArtifactsS3BucketName",ParameterValue="${bucket_name}" \
      ParameterKey="LambdaFunctionsCodeS3Key",ParameterValue="${code_s3_key}" \
      ParameterKey="SPAPICreateInboundPlanLambdaFunctionHandler",ParameterValue="${create_inbound_plan_func_handler}" \
      ParameterKey="SPAPIOperationStatusLambdaFunctionHandler",ParameterValue="${operation_status_func_handler}" \
      ParameterKey="SPAPISetPackingInformationLambdaFunctionHandler",ParameterValue="${set_packing_information_func_handler}" \
      ParameterKey="SPAPIGeneratePlacementOptionsLambdaFunctionHandler",ParameterValue="${generate_placement_options_func_handler}" \
      ParameterKey="SPAPIListPlacementOptionsLambdaFunctionHandler",ParameterValue="${list_placement_options_func_handler}" \
      ParameterKey="SPAPIGenerateTransportationOptionsLambdaFunctionHandler",ParameterValue="${generate_transportation_options_func_handler}" \
      ParameterKey="SPAPIGenerateDeliveryWindowOptionsLambdaFunctionHandler",ParameterValue="${generate_delivery_window_options_func_handler}" \
      ParameterKey="SPAPIListTransportationOptionsLambdaFunctionHandler",ParameterValue="${list_transportation_options_func_handler}" \
      ParameterKey="SPAPIListDeliveryWindowOptionsLambdaFunctionHandler",ParameterValue="${list_delivery_window_options_func_handler}" \
      ParameterKey="SPAPIConfirmPlacementOptionLambdaFunctionHandler",ParameterValue="${confirm_placement_option_func_handler}" \
      ParameterKey="SPAPIConfirmDeliveryWindowOptionsLambdaFunctionHandler",ParameterValue="${confirm_delivery_window_options_func_handler}" \
      ParameterKey="SPAPIConfirmTransportationOptionsLambdaFunctionHandler",ParameterValue="${confirm_transportation_options_func_handler}" \
      ParameterKey="SPAPIGetShipmentLambdaFunctionHandler",ParameterValue="${get_shipment_func_handler}" \
      ParameterKey="SPAPIGetLabelsLambdaFunctionHandler",ParameterValue="${get_labels_func_handler}" \
      ParameterKey="SPAPIUpdateShipmentTrackingDetailsLambdaFunctionHandler",ParameterValue="${update_shipment_tracking_details_handler}" \
      ParameterKey="StepFunctionsStateMachineDefinitionS3Key",ParameterValue="${state_machine_s3_key}" \
      ParameterKey="StepFunctionsStateMachineTrackingDetailsDefinitionS3Key",ParameterValue="${state_machine_tracking_details_s3_key}" \
      ParameterKey="NotificationEmail",ParameterValue="${notification_email}"
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