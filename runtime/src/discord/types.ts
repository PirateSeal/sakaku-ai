
export type InteractionType = 1 | 2 | 3 | 4 | 5; // minimal
export interface Interaction {
  type: InteractionType;
  id: string;
  token: string;
  data?: {
    name?: string;
    options?: { name: string; value: string }[];
  };
  guild_id?: string;
}

export interface DiscordResponse {
  type: number;
  data?: {
    content?: string;
    flags?: number;
  };
}
