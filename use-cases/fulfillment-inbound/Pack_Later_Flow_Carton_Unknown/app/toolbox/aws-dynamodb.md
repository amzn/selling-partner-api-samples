## AWS DynamoDB table

To add a new DynamoB table to the SP-API application, follow the steps below:

1. Open the CloudFormation template file ([app-template.yaml](..%2Fapp-template.yaml)).
2. Update the following DynamoDB table definition by replacing **DEMO** with the name of your table, and **KEY** with
   the name of your table's key; if you will use add additional attributes, add them to `AttributeDefinitions` section.
   Add the definition to the `Resources` section of the CloudFormation template.

```
DEMOTable:
  Type: 'AWS::DynamoDB::Table'
  Properties:
    TableName: !Join
      - '-'
      - - SPAPIDEMO
        - !Ref RandomSuffix
    AttributeDefinitions:
      - AttributeName: KEY
        AttributeType: S
    KeySchema:
      - AttributeName: KEY
        KeyType: HASH
    BillingMode: PAY_PER_REQUEST
    PointInTimeRecoverySpecification:
      PointInTimeRecoveryEnabled: true
```

3. Add an Environment Variable (replace **DEMO** with the name from step 2.) to `Environment` section of the Lambda
   function/s that will access the DynamoDB table.

```
DEMO_TABLE_NAME: !Ref DEMOTable
```

4. Update the following policy definition (replace **DEMO** with the name from step 2.) to match the access you need,
   and add it to `Properties / Policies` section of the Execution Role linked to the Lambda function/s that will access
   the DynamoDB table. This example provides write access by enabling the `dynamodb:PutItem` action.

```
- PolicyName: DynamoDBDEMOPolicy
  PolicyDocument:
    Version: 2012-10-17
    Statement:
      - Effect: Allow
        Action: 'dynamodb:PutItem'
        Resource: !GetAtt
          - DEMOTable
          - Arn
```

5. If this is the first DynamoDB table you add to the CloudFormation template, update the SP-API app's policy
   file ([iam-policy.json](..%2Fscripts%2Fiam-policy.json)) to include permissions to create DynamoDB resources.

```
{
  "Sid": "DynamoDBPermissions",
  "Effect": "Allow",
  "Action": [
    "dynamodb:CreateTable",
    "dynamodb:DeleteTable",
    "dynamodb:DescribeTable"
  ],
  "Resource": "*"
}
```