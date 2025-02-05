## AWS SQS queue

To add a new SQS queue to the SP-API application, follow the steps below:

1. Open the CloudFormation template file ([app-template.yaml](..%2Fapp-template.yaml)).
2. Update the following SQS queue definition by replacing **DEMO** with the name of your queue. Add the definition to
   the `Resources` section of the CloudFormation template.

```
DEMOQueue:
  Type: 'AWS::SQS::Queue'
  Properties:
    QueueName: !Join
      - '-'
      - - sp-api-DEMO-queue
        - !Ref RandomSuffix
    VisibilityTimeout: 300
```

3. If the queue will be used to receive notifications from the SP-API, add the following queue policy to provide the
   corresponding permissions (replace **DEMO** with the name from step 2.).

```
DEMOQueuePolicy:
  Type: 'AWS::SQS::QueuePolicy'
  Properties:
    Queues:
      - !Ref DEMOQueue
    PolicyDocument:
      Statement:
        - Effect: Allow
          Action:
            - 'SQS:SendMessage'
            - 'SQS:GetQueueAttributes'
          Resource: !GetAtt
            - DEMOQueue
            - Arn
          Principal:
            AWS:
              - '437568002678'
```

4. If messages in the SQS queue will be processed by a Lambda function, add the following event source mapping to link
   the queue with the function (replace **DEMO** with the name from step 2., and **LAMBDA** with the name of the Lambda
   function that will process the incoming messages).

```
DEMOEventSourceMapping:
  Type: 'AWS::Lambda::EventSourceMapping'
  Properties:
    BatchSize: 1
    Enabled: true
    EventSourceArn: !GetAtt
      - DEMOQueue
      - Arn
    FunctionName: !GetAtt
      - LAMBDA
      - Arn
```

5. If messages in the SQS queue will be processed by a Lambda function, add the following policy
   to `Properties / Policies` section of the Lambda function's execution role (replace **DEMO** with the name from step
   2.).

```
- PolicyName: SQSDEMOPolicy
  PolicyDocument:
    Version: 2012-10-17
    Statement:
      - Effect: Allow
        Action:
          - 'SQS:DeleteMessage'
          - 'SQS:GetQueueAttributes'
          - 'SQS:ReceiveMessage'
        Resource: !GetAtt
          - DEMOQueue
          - Arn
```

6. If this is the first SQS queue you add to the CloudFormation template, update the SP-API app's policy
   file ([iam-policy.json](..%2Fscripts%2Fiam-policy.json)) to include permissions to create SQS resources.

```
{
  "Sid": "SQSPermissions",
  "Effect": "Allow",
  "Action": [
    "sqs:CreateQueue",
    "sqs:DeleteQueue",
    "sqs:SetQueueAttributes",
    "sqs:GetQueueAttributes"
  ],
  "Resource": "*"
}
```