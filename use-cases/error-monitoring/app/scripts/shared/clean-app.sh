#!/bin/bash

# Get the resources file path from the input arguments
resources_file_path=""
while getopts 'p:' flag; do
  case "${flag}" in
    p) resources_file_path="../${OPTARG}";;
  esac
done

# Retrieve IDs of created resources
user_name="$(grep "^user_name=" "${resources_file_path}" | cut -d"=" -f2)"
policy_arn="$(grep "^policy_arn=" "${resources_file_path}" | cut -d"=" -f2)"
access_key="$(grep "^access_key=" "${resources_file_path}" | cut -d"=" -f2)"
secret_key="$(grep "^secret_key=" "${resources_file_path}" | cut -d"=" -f2)"
bucket_name="$(grep "^bucket_name=" "${resources_file_path}" | cut -d"=" -f2)"
stack_name="$(grep "^stack_name=" "${resources_file_path}" | cut -d"=" -f2)"

# Delete CloudFormation resources
echo "Deleting CloudFormation stack"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws cloudformation delete-stack --stack-name ${stack_name}

# TODO: sleep until the CloudFormation stack is deleted
sleep 120

# Delete S3 resources
echo "Deleting S3 resources"
AWS_ACCESS_KEY_ID=${access_key} AWS_SECRET_ACCESS_KEY=${secret_key} \
  aws s3 rb s3://${bucket_name} --force

# Delete IAM resources
echo "Deleting IAM resources"
aws iam delete-access-key --user-name ${user_name} --access-key-id ${access_key}
aws iam detach-user-policy --user-name ${user_name} --policy-arn ${policy_arn}
aws iam delete-policy --policy-arn ${policy_arn}
aws iam delete-user --user-name ${user_name}

# Delete the resources file
echo "${resources_file_path}"
rm "${resources_file_path}"

echo "Successfully cleaned up the SP-API app"