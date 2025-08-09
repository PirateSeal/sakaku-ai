import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secrets from 'aws-cdk-lib/aws-secretsmanager';
import * as iam from 'aws-cdk-lib/aws-iam';

export class DiscordBotStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Secrets (replace names with your existing secret names)
    const discordToken = secrets.Secret.fromSecretNameV2(this, 'DiscordBotToken', 'DISCORD_BOT_TOKEN');
    const discordPublicKey = secrets.Secret.fromSecretNameV2(this, 'DiscordPublicKey', 'DISCORD_PUBLIC_KEY');
    const geminiApiKey = secrets.Secret.fromSecretNameV2(this, 'GeminiApiKey', 'GEMINI_API_KEY');

    const logGroup = new logs.LogGroup(this, 'InteractionsFnLogs', {
      retention: logs.RetentionDays.TWO_WEEKS,
    });

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

    // Grant read access to the three secrets
    discordToken.grantRead(interactionsFn);
    discordPublicKey.grantRead(interactionsFn);
    geminiApiKey.grantRead(interactionsFn);

    const httpApi = new apigwv2.HttpApi(this, 'DiscordHttpApi', {
      apiName: 'discord-interactions',
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

    new cdk.CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
  }
}
