import { request } from 'undici';

/**
 * Upsert slash commands with Discord.
 * Requires environment variables:
 * - DISCORD_APP_ID
 * - DISCORD_BOT_TOKEN
 * Optional:
 * - DISCORD_GUILD_ID (register commands for a single guild if set)
 */
async function main() {
  const appId = process.env.DISCORD_APP_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!appId || !token) {
    throw new Error('DISCORD_APP_ID and DISCORD_BOT_TOKEN must be set');
  }

  const commands = [
    {
      type: 1,
      name: 'ask',
      description: 'Ask Gemini a question',
      options: [
        {
          type: 3,
          name: 'question',
          description: 'The question to ask (max 250 chars)',
          required: true,
          max_length: 250,
        },
        {
          type: 5,
          name: 'private',
          description: 'Respond only to you',
          required: false,
        },
      ],
    },
    { type: 1, name: 'help', description: 'How to use this bot' },
  ];

  const url = guildId
    ? `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`
    : `https://discord.com/api/v10/applications/${appId}/commands`;

  const res = await request(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bot ${token}`,
    },
    body: JSON.stringify(commands),
  });

  if (res.statusCode >= 400) {
    const body = await res.body.text();
    console.error(`Discord API error ${res.statusCode}: ${body}`);
    process.exit(1);
  }

  console.log('Upserted slash commands');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
