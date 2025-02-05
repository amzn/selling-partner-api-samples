## AWS Lambda function

To add a new Lambda function to the SP-API application, follow the steps below:

1. Open the CloudFormation template file ([app-template.yaml](..%2Fapp-template.yaml)).
2. Update the following Lambda function definition by replacing **DEMO** with the name of your function, and add it to
   the `Resources` section of the CloudFormation template. If you decide to use an existing Execution Role, replace *
   *DEMOLambdaExecutionRole** with the corresponding name. If you will use additional Environment Variables, add them
   under `Environment` section.

```
DEMOLambdaFunction:
  Type: 'AWS::Lambda::Function'
  Properties:
    FunctionName: !Join
      - '-'
      - - SPAPIDEMOFunction
        - !Ref RandomSuffix
    Description: DEMO Lambda function
    Code:
      S3Bucket: !Ref ArtifactsS3BucketName
      S3Key: !Ref LambdaFunctionsCodeS3Key
    Handler: !Ref DEMOLambdaFunctionHandler
    Role: !GetAtt
      - DEMOLambdaExecutionRole
      - Arn
    Runtime: !Ref ProgrammingLanguage
    MemorySize: 512
    Timeout: 60
    Environment:
      Variables:
        IAM_USER_CREDENTIALS_SECRET_ARN: !Ref SPAPIUserCredentials
        SP_API_APP_CREDENTIALS_SECRET_ARN: !Ref SPAPIAppCredentials
        ROLE_ARN: !Ref RoleArn
```

3. Add a CloudFormation parameter to the CloudFormation template to specify the Lambda function's handler name.
    1. Add `DEMOLambdaFunctionHandler` (replace **DEMO** with the name from step 2.)
       to `Metadata / AWS::CloudFormation::Interface / ParameterGroups / Parameters`, in the corresponding group; create
       a new group if it applies.
    2. Add the following definition (replace **DEMO** with the name from step 2.)
       to `Metadata / AWS::CloudFormation::Interface / ParameterGroups / ParameterLabels`.
    ```
    DEMOLambdaFunctionHandler:
      default: Handler of DEMO Lambda Function
    ```
    3. Add the following definition (replace **DEMO** with the name from step 2.) to `Parameters`, in the corresponding
       group; create a new group if it applies.
    ```
    DEMOLambdaFunctionHandler:
      Type: String
      MinLength: 1
      Description: Handler of DEMO Lambda Function
    ```
4. Update the following Step Functions definition substitution (replace **DEMO** with the name from step 2.), and add it
   to `DefinitionSubstitutions` section of **SPAPIStateMachine** of the CloudFormation template. Definition
   substitutions provide a way to specify the Lambda function's ARN to the state machine.

```
DEMOLambdaFunctionArn: !GetAtt
  - DEMOLambdaFunction
  - Arn
```

5. Update the following policy definition (replace **DEMO** with the name from step 2.), and add it
   to `Policies / PolicyDocument / Statement / Resource` section of **SPAPIStateMachineExecutionRole** of the
   CloudFormation template. This policy grants the state machine permissions to execute the Lambda function.

```
- !GetAtt
  - DEMOLambdaFunction
  - Arn
```

6. Add the Lambda function's handler in the corresponding path for the programming language you will use. For example,
   for a Java function the correct path is `code/java/src/main/java/lambda`
7. Open the deployment script ([deploy-app.sh](..%2Fscripts%2Fshared%2Fdeploy-app.sh)).
8. In the code packaging and upload section, add a variable definition for your Lambda function's handler. For example,
   for a Java function the variable definition would be `DEMO_lambda_func_handler="lambda.DEMOLambdaHandler"`
9. Add the following instruction (replace **DEMO** with the name from step 2.) to the CloudFormation stack creation
   command, under the `--parameters` section. This instruction provides CloudFormation with the Lambda function's
   handler name during stack creation.

```
ParameterKey="DEMOLambdaFunctionHandler",ParameterValue="${DEMO_lambda_func_handler}" \
```

10. Update the Step Functions state machine
    definition ([step-functions-workflow-definition.json](..%2Fstep-functions%2Fstep-functions-workflow-definition.json))
    with a step representing the new Lambda function. You can use the existing steps in the JSON file as a reference.