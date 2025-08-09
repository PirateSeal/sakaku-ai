export type Interaction = import('../discord/types').Interaction;
export type DiscordResponse = import('../discord/types').DiscordResponse;

const EPHEMERAL_FLAG = 64;

export const routeInteraction = (interaction: Interaction): DiscordResponse => {
  if (interaction.type === 1) {
    return { type: 1 };
  }

  if (interaction.type === 2 && interaction.data?.name) {
    const name = interaction.data.name;

    if (name === 'help') {
      return {
        type: 4,
        data: {
          content: 'Use `/ask question:<text> [private:true]` to ask a question. Use `/help` to see this message.',
          flags: EPHEMERAL_FLAG,
        },
      };
    }

    if (name === 'ask') {
      const opts = interaction.data.options ?? [];
      const questionOpt = opts.find(o => o.name === 'question');
      const privateOpt = opts.find(o => o.name === 'private');

      const question =
        typeof questionOpt?.value === 'string' ? questionOpt.value.trim() : '';
      const isPrivate = privateOpt?.value === true;

      if (!question) {
        return {
          type: 4,
          data: {
            content: 'Usage: /ask question:<text> [private:true]',
            flags: EPHEMERAL_FLAG,
          },
        };
      }

      return {
        type: 4,
        data: {
          content: 'Processing your question…',
          ...(isPrivate ? { flags: EPHEMERAL_FLAG } : {}),
        },
      };
    }

    return {
      type: 4,
      data: {
        content: `Unknown command: ${name}`,
        flags: EPHEMERAL_FLAG,
      },
    };
  }

  return {
    type: 4,
    data: {
      content: 'Unsupported interaction type',
      flags: EPHEMERAL_FLAG,
    },
  };
};

