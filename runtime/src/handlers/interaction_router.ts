import type { Interaction, DiscordResponse } from '../discord/types.js';

const EPHEMERAL_FLAG = 64;

export function routeInteraction(interaction: Interaction): DiscordResponse {
  if (interaction.type === 1) {
    return { type: 1 };
  }

  if (interaction.type === 2 && interaction.data?.name === 'help') {
    return {
      type: 4,
      data: {
        content: 'Use `/ask question:<text>` to query Gemini. Add `private:true` for an ephemeral reply.',
        flags: EPHEMERAL_FLAG,
      },
    };
  }

  return {
    type: 4,
    data: {
      content: 'Unknown command',
      flags: EPHEMERAL_FLAG,
    },
  };
}

export { EPHEMERAL_FLAG };
