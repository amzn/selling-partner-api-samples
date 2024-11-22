#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { SpApiAppCdkStack } from '../lib/sp-api-app-cdk-stack';

const app = new cdk.App();
new SpApiAppCdkStack(app, 'sp-api-app-cdk', {
  randomSuffix: app.node.tryGetContext("RANDOM_SUFFIX"),
  spApiCdkQualifier: app.node.tryGetContext("CDK_QUALIFIER")
});