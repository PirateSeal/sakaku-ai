export type Interaction = import('../discord/types').Interaction;
export type DiscordResponse = import('../discord/types').DiscordResponse;

const EPHEMERAL_FLAG = 64;
const ALLOWED_NONE = { parse: [] as string[] };
const USAGE_ASK = 'Usage: /ask question:<text> [private:true]';
const USAGE_HELP = 'Use `/ask question:<text> [private:true]` to ask a question. Use `/help` to see this message.';

export const routeInteraction = (interaction: Interaction): DiscordResponse => {
  if (interaction.type === 1) {
    return { type: 1 };
  }

  if (interaction.type === 2 && interaction.data?.name) {
    const name = String(interaction.data.name).toLowerCase();

    if (name === 'help') {
      return {
        type: 4,
        data: {
          content: USAGE_HELP,
          flags: EPHEMERAL_FLAG,
          allowed_mentions: ALLOWED_NONE,
        },
      };
    }

    if (name === 'ask') {
      const opts = interaction.data.options ?? [];
      const questionOpt = opts.find(o => o.name === 'question');
      const privateOpt = opts.find(o => o.name === 'private');

      const question =
        typeof questionOpt?.value === 'string' ? questionOpt.value.trim() : '';
      // Be defensive in case value is not strictly boolean at runtime
      const isPrivate = privateOpt?.value === true || privateOpt?.value === 'true';

      if (!question) {
        return {
          type: 4,
          data: {
            content: USAGE_ASK,
            flags: EPHEMERAL_FLAG,
            allowed_mentions: ALLOWED_NONE,
          },
        };
      }

      return {
        type: 4,
        data: {
          content: 'Processing your question…',
          ...(isPrivate ? { flags: EPHEMERAL_FLAG } : {}),
          allowed_mentions: ALLOWED_NONE,
        },
      };
    }

    return {
      type: 4,
      data: {
        content: `Unknown command: ${name}`,
        flags: EPHEMERAL_FLAG,
        allowed_mentions: ALLOWED_NONE,
      },
    };
  }

  return {
    type: 4,
    data: {
      content: 'Unsupported interaction type',
      flags: EPHEMERAL_FLAG,
      allowed_mentions: ALLOWED_NONE,
    },
  };
};

