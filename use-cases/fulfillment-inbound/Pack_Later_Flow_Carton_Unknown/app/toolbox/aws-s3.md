## AWS S3 bucket

To add a new S3 bucket to the SP-API application, follow the steps below:

1. Open the CloudFormation template file ([app-template.yaml](..%2Fapp-template.yaml)).
2. Update the following S3 bucket definition by replacing **DEMO** with the name of your bucket, and **DOCDESCRIPTION**
   with the name of your bucket's key; Add the definition to the `Resources` section of the CloudFormation template.

```
DEMOS3Bucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      PublicAccessBlockConfiguration:
        BlockPublicAcls: true
        IgnorePublicAcls: true
        BlockPublicPolicy: true
        RestrictPublicBuckets: true
      BucketName: !Join
        - '-'
        - - sp-api-DOCDESCRIPTION-s3-bucket
          - !Ref RandomSuffix
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
```

3. Add an Environment Variable (replace **DEMO** with the name from step 2.) to `Environment` section of the Lambda
   function/s that will access the S3 bucket.

```
DEMO_S3_BUCKET_NAME: !Ref DEMOS3Bucket
```

4. Update the following policy definition (replace **DEMO** with the name from step 2.) to match the access you need,
   and add it to `Properties / Policies` section of the Execution Role linked to the Lambda function/s that will access
   the S3 bucket. This example provides write access by enabling the `s3:PutObject` action.

```
- PolicyName: S3DEMOPolicy
  PolicyDocument:
    Version: 2012-10-17
    Statement:
        - Effect: Allow
          Action:
            - 's3:PutObject'
          Resource: !Sub
            - '${BucketArn}/*'
            - BucketArn: !GetAtt
                - DEMOS3Bucket
                - Arn
```

5. If this is the first S3 bucket you add to the CloudFormation template, update the SP-API app's policy
   file ([iam-policy.json](..%2Fscripts%2Fiam-policy.json)) to include permissions to create S3 resources.

```
{
   "Sid": "S3Permissions",
   "Effect": "Allow",
   "Action": [
     "s3:CreateBucket",
     "s3:DeleteBucket",
     "s3:ListBucket",
     "s3:PutBucketPublicAccessBlock",
     "s3:PutEncryptionConfiguration",
     "s3:PutObject",
     "s3:DeleteObject",
     "s3:GetObject"
   ],
   "Resource": "*"
}
```