export type AskParams = { prompt: string; maxTokens?: number };

export async function askFastMock({ prompt }: AskParams): Promise<string> {
  // Short, deterministic answer for tests
  return `Mocked answer to: ${prompt.slice(0, 100)}`;
}
