#!/bin/bash

# Get the resources file path from the input arguments
resources_file_path=""
while getopts 'p:' flag; do
  case "${flag}" in
    p) resources_file_path="../${OPTARG}";;
  esac
done

# Retrieve IDs of created resources
policy_arn="$(grep "^policy_arn=" "${resources_file_path}" | cut -d"=" -f2)"
bucket_name="$(grep "^bucket_name=" "${resources_file_path}" | cut -d"=" -f2)"
app_command="$(grep "^app_command=" "${resources_file_path}" | cut -d"=" -f2)"
outbound_bucket_name="$(grep "^outbound_bucket_name=" "${resources_file_path}" | cut -d"=" -f2)"
stack_name="$(grep "^stack_name=" "${resources_file_path}" | cut -d"=" -f2)"
cdk_deploy_output="$(grep "^cdk_deploy_output=" "${resources_file_path}" | cut -d"=" -f2)"
random_suffix="$(grep "^random_suffix=" "${resources_file_path}" | cut -d"=" -f2)"
aws_account_id="$(grep "^aws_account_id=" "${resources_file_path}" | cut -d"=" -f2)"
aws_region="$(grep "^aws_region=" "${resources_file_path}" | cut -d"=" -f2)"
cdk_namespace="$(grep "^cdk_namespace=" "${resources_file_path}" | cut -d"=" -f2)"

#Empty Fulfillment Outbound S3 bucket
aws s3 rm s3://${outbound_bucket_name} --recursive

# Delete CDK stack
echo "Deleting CDK stack"
cdk destroy --output "${cdk_deploy_output}" --app "${app_command}" "${stack_name}" -c RANDOM_SUFFIX="${random_suffix}" -c CDK_QUALIFIER="${cdk_namespace}"

# Delete S3 resources
echo "Deleting S3 resources"
aws s3 rb s3://${bucket_name} --force

# Delete IAM resources
echo "Deleting IAM resources"
aws iam detach-role-policy --role-name "cdk-${cdk_namespace}-cfn-exec-role-${aws_account_id}-${aws_region}" --policy-arn ${policy_arn}
aws iam delete-policy --policy-arn "${policy_arn}"

# Delete the resources file
echo "${resources_file_path}"
rm "${resources_file_path}"

echo "Successfully cleaned up the SP-API app"