#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SpApiOauthStack } from '../lib/SpApiOauthStack';

const app = new cdk.App();

// Get the instance name from command-line arguments
const inputInstance = app.node.tryGetContext('instance') || '';

// Create the full instance name with the prefix
const instanceName = inputInstance 
  ? `SpApiOauthStack-${inputInstance}` 
  : 'SpApiOauthStack';

// Create the stack with the instance name
new SpApiOauthStack(app, instanceName, {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-*' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */

  // Add a stack name that includes the instance name
  stackName: instanceName,
});

// Add a tag to the stack with the original input instance name (if provided)
if (inputInstance) {
  cdk.Tags.of(app).add('instance', inputInstance);
}
