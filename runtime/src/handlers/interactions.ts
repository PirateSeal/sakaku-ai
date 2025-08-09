
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { verifyDiscordRequest } from '../discord/verify.js';
import type { Interaction, DiscordResponse } from '../discord/types.js';
import { askGemini } from '../gemini/client.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const secrets = new SecretsManagerClient({});

const EPHEMERAL_FLAG = 64;
const DEFAULT_MODEL = process.env.MODEL_ID ?? 'gemini-1.5-flash';
const RESPONSE_MAX_TOKENS = Number(process.env.RESPONSE_MAX_TOKENS ?? '1024');
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? '9000');

async function getSecret(name: string): Promise<string> {
  const res = await secrets.send(new GetSecretValueCommand({ SecretId: name }));
  if (!res.SecretString) throw new Error(`Secret ${name} has no string value`);
  return res.SecretString;
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const requestId = event.requestContext.requestId;
  const rawBody = event.body ?? '';
  const sig = event.headers['x-signature-ed25519'] ?? event.headers['X-Signature-Ed25519'];
  const ts = event.headers['x-signature-timestamp'] ?? event.headers['X-Signature-Timestamp'];

  try {
    if (!sig || !ts) return { statusCode: 401, body: 'missing signature headers' };

    const publicKeyName = process.env.SECRETS_DISCORD_PUBLIC_KEY_NAME!;
    const publicKey = await getSecret(publicKeyName);

    // Verify request
    const ok = verifyDiscordRequest(publicKey, sig, ts, rawBody);
    if (!ok) return { statusCode: 401, body: 'invalid request signature' };

    const interaction = JSON.parse(rawBody) as Interaction;

    // 1) PING
    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    // 2) Slash command (type=2)
    if (interaction.type === 2 && interaction.data?.name) {
      const name = interaction.data.name;

      if (name === 'help') {
        return json({
          type: 4,
          data: {
            content: 'Use `/ask <prompt>` to query Gemini. Replies are ephemeral by default.',
            flags: EPHEMERAL_FLAG,
          },
        });
      }

      if (name === 'ask') {
        // Decide whether to defer (simple heuristic)
        const prompt = (interaction.data.options?.find(o => o.name === 'prompt')?.value ?? '').toString();
        const shouldDefer = prompt.length > 200 || TIMEOUT_MS < 6000;

        if (shouldDefer) {
          // Deferred response
          queueMicrotask(async () => {
            try {
              const apiKey = await getSecret(process.env.SECRETS_GEMINI_API_KEY_NAME!);
              const answer = await askGemini({
                apiKey,
                model: DEFAULT_MODEL,
                prompt: prompt.slice(0, 4000),
                maxOutputTokens: RESPONSE_MAX_TOKENS,
                timeoutMs: TIMEOUT_MS - 1000,
              });

              // Post follow-up using callback URL
              // NOTE: For MVP, we simply log the answer. Replace with Discord follow-up call if needed.
              console.log(JSON.stringify({ requestId, phase: 'followup', answerLen: answer.length }));
            } catch (err) {
              console.error(JSON.stringify({ requestId, phase: 'followup_error', err: String(err) }));
            }
          });

          return json({
            type: 5,
            data: { flags: EPHEMERAL_FLAG },
          });
        } else {
          // Immediate
          const apiKey = await getSecret(process.env.SECRETS_GEMINI_API_KEY_NAME!);
          const answer = await askGemini({
            apiKey,
            model: DEFAULT_MODEL,
            prompt: prompt.slice(0, 4000),
            maxOutputTokens: RESPONSE_MAX_TOKENS,
            timeoutMs: TIMEOUT_MS - 500,
          });

          return json({
            type: 4,
            data: {
              content: sanitizeForDiscord(answer),
              flags: EPHEMERAL_FLAG,
            },
          });
        }
      }
    }

    // Unknown path
    return { statusCode: 400, body: 'unsupported interaction' };
  } catch (err) {
    console.error(JSON.stringify({ requestId, phase: 'error', err: String(err) }));
    return json({
      type: 4,
      data: {
        content: 'Sorry, something went wrong. Please try again shortly.',
        flags: EPHEMERAL_FLAG,
      },
    });
  }
};

function sanitizeForDiscord(s: string): string {
  // Minimal sanitization to avoid accidental mentions
  return s.replace(/@/g, '@​').slice(0, 1800);
}

function json(body: DiscordResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
