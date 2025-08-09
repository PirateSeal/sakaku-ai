import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';

/**
 * Stack that hosts the SakakuAI Discord bot HTTP endpoint and Lambda handler.
 *
 * Secrets used here are **referenced by name only** and must exist in
 * AWS Secrets Manager prior to deployment.
 */
export class SakakuAiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // References to existing Secrets Manager secrets (no values in code)
    const discordToken = secrets.Secret.fromSecretNameV2(this, 'DiscordBotToken', 'DISCORD_BOT_TOKEN');
    const discordPublicKey = secrets.Secret.fromSecretNameV2(this, 'DiscordPublicKey', 'DISCORD_PUBLIC_KEY');
    const geminiApiKey = secrets.Secret.fromSecretNameV2(this, 'GeminiApiKey', 'GEMINI_API_KEY');

    // CloudWatch LogGroup for Lambda with 14-day retention
    const logGroup = new logs.LogGroup(this, 'InteractionsFnLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
    });

    // Lambda function handling Discord interactions
    const interactionsFn = new nodejs.NodejsFunction(this, 'InteractionsFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: '../runtime/src/handlers/interactions.ts',
      handler: 'handler',
      memorySize: 256,
      timeout: cdk.Duration.seconds(15),
      logGroup,
      environment: {
        SECRETS_DISCORD_TOKEN_NAME: discordToken.secretName,
        SECRETS_DISCORD_PUBLIC_KEY_NAME: discordPublicKey.secretName,
        SECRETS_GEMINI_API_KEY_NAME: geminiApiKey.secretName,
        MODEL_ID: 'gemini-1.5-flash',
        RESPONSE_MAX_TOKENS: '1024',
        TIMEOUT_MS: '9000',
      },
    });

    // Grant least-privilege access to the secrets
    discordToken.grantRead(interactionsFn);
    discordPublicKey.grantRead(interactionsFn);
    geminiApiKey.grantRead(interactionsFn);

    // HTTP API that receives Discord interaction webhooks
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      apiName: 'sakakuai-api',
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [apigwv2.CorsHttpMethod.POST, apigwv2.CorsHttpMethod.OPTIONS],
      },
    });

    httpApi.addRoutes({
      path: '/discord/interactions',
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('InteractionsIntegration', interactionsFn),
    });

    // Basic alarm on HTTP 5XX errors from the API
    new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      metric: httpApi.metricServerError({ period: cdk.Duration.minutes(1) }),
      threshold: 1,
      evaluationPeriods: 1,
    });

    // Stack output: API base URL
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: httpApi.apiEndpoint,
    });
  }
}
