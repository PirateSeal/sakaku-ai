import 'source-map-support/register.js';
import * as cdk from 'aws-cdk-lib';
import { DiscordBotStack } from '../lib/discord-bot-stack.js';

const app = new cdk.App();
new DiscordBotStack(app, 'DiscordBotStack', {
  env: {
    // Optionally set your account and region here
    // account: process.env.CDK_DEFAULT_ACCOUNT,
    // region: process.env.CDK_DEFAULT_REGION,
  },
});
