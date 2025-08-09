
export type InteractionType = 1 | 2 | 3 | 4 | 5; // minimal
export interface Interaction {
  type: InteractionType;
  id: string;
  token: string;
  application_id: string;
  data?: {
    name?: string;
    options?: { name: string; value: string | boolean }[];
  };
  guild_id?: string;
  channel_id?: string;
  member?: { user?: { id: string } };
  user?: { id: string };
}

export interface DiscordResponse {
  type: number;
  data?: {
    content?: string;
    flags?: number;
  };
}
