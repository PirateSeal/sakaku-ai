import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

export async function getSecretString(secretId: string): Promise<string> {
  const out = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!out.SecretString) throw new Error(`Secret ${secretId} has no SecretString`);
  return out.SecretString;
}
