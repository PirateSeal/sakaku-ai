
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { verifyDiscordRequest } from '../discord/verify.js';
import type { Interaction, DiscordResponse } from '../discord/types.js';
import { askGemini } from '../gemini/client.js';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { request } from 'undici';
import { routeInteraction } from './interaction_router.js';
import { getSecretString } from '../util/secrets.js';

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

export const legacyHandler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
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
            content: 'Use `/ask question:<text>` to query Gemini. Add `private:true` for an ephemeral reply.',
            flags: EPHEMERAL_FLAG,
          },
        });
      }

      if (name === 'ask') {
        const opts = interaction.data.options ?? [];
        const question = (opts.find(o => o.name === 'question')?.value ?? '').toString().trim();
        const isPrivate =
          opts.find(o => o.name === 'private')?.value === true ||
          opts.find(o => o.name === 'private')?.value === 'true';
        const userId = interaction.member?.user?.id ?? interaction.user?.id ?? 'unknown';

        if (!question || question.length > 250) {
          console.log(JSON.stringify({ requestId, guildId: interaction.guild_id, userId, status: 'invalid' }));
          return json({
            type: 4,
            data: { content: 'Invalid question', flags: EPHEMERAL_FLAG },
          });
        }

        queueMicrotask(async () => {
          const started = Date.now();
          let status: 'success' | 'timeout' | 'error' = 'success';
          let content: string;
          try {
            const apiKey = await getSecret(process.env.SECRETS_GEMINI_API_KEY_NAME!);
            const answer = await askGemini({
              apiKey,
              model: DEFAULT_MODEL,
              prompt: question,
              maxOutputTokens: RESPONSE_MAX_TOKENS,
              timeoutMs: TIMEOUT_MS - 1000,
            });
            content = sanitizeForDiscord(answer);
          } catch (err) {
            const msg = String(err).toLowerCase();
            if (msg.includes('timeout')) {
              status = 'timeout';
              content = 'Timeout: please try again';
            } else {
              status = 'error';
              content = 'Sorry, something went wrong. Please try again.';
            }
          }

          try {
            await request(`https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ content, flags: isPrivate ? EPHEMERAL_FLAG : 0 }),
            });
          } catch (err) {
            console.error(JSON.stringify({ requestId, phase: 'followup_error', err: String(err) }));
          }

          const latencyMs = Date.now() - started;
          console.log(
            JSON.stringify({ requestId, guildId: interaction.guild_id, userId, status, latencyMs })
          );
        });

        return json({
          type: 5,
          data: { flags: isPrivate ? EPHEMERAL_FLAG : 0 },
        });
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

export function handleHelp(): DiscordResponse {
  return {
    type: 4,
    data: {
      content: generateHelpMessage(),
      flags: EPHEMERAL_FLAG,
    },
  };
}

export function generateHelpMessage(): string {
  const msg = [
    'Need assistance? Use `/ask <prompt>` to query the Gemini model.',
    'The bot replies only to you so conversations stay private.',
    '',
    'Example:',
    '`/ask How do I write a Lambda?`',
  ].join('\n');

  // Sanitize and ensure we respect Discord limits (2000 char max)
  return sanitizeForDiscord(msg).slice(0, 2000);
}

function sanitizeForDiscord(s: string): string {
  // Minimal sanitization to avoid accidental mentions
  return s.replace(/@/g, '@​').slice(0, 1000);
}

function json(body: DiscordResponse): APIGatewayProxyResultV2 {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    const pkName = process.env.SECRETS_DISCORD_PUBLIC_KEY_NAME;
    if (!pkName) return { statusCode: 500, body: 'Missing public key name' };

    const rawBody = event.body ?? '';
    const isBase64 = event.isBase64Encoded;
    const decoded = isBase64
      ? Buffer.from(rawBody, 'base64').toString('utf8')
      : rawBody;

    const sig =
      event.headers['x-signature-ed25519'] ??
      event.headers['X-Signature-Ed25519'];
    const ts =
      event.headers['x-signature-timestamp'] ??
      event.headers['X-Signature-Timestamp'];
    if (!sig || !ts)
      return { statusCode: 401, body: 'Missing signature headers' };

    const publicKey = await getSecretString(pkName);
    const ok = verifyDiscordRequest(publicKey, String(sig), String(ts), decoded);
    if (!ok) return { statusCode: 401, body: 'invalid request signature' };

    const interaction = JSON.parse(decoded);
    const resp = routeInteraction(interaction);
    return {
      statusCode: 200,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(resp),
    };
  } catch (e) {
    console.error('interactions handler error', e);
    return { statusCode: 500, body: 'Internal error' };
  }
};
