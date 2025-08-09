import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { SakakuAiStack } from '../lib/sakakuai-stack.js';

const app = new cdk.App();
new SakakuAiStack(app, 'SakakuAiStack', {
  env: {
    // Optionally specify the target AWS account and region
    // account: process.env.CDK_DEFAULT_ACCOUNT,
    // region: process.env.CDK_DEFAULT_REGION,
  },
});
