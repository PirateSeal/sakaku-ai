
import { setTimeout as delay } from 'node:timers/promises';
import { request } from 'undici';

/**
 * Minimal Gemini client stub calling Google AI API (HTTP/JSON).
 * Replace endpoint and shape with your account's specifics.
 */
export async function askGemini(opts: {
  apiKey: string;
  model: string;
  prompt: string;
  maxOutputTokens: number;
  timeoutMs: number;
}): Promise<string> {
  // Placeholder: simulate a call so the skeleton runs without external creds.
  // Replace with real HTTP call to Gemini (e.g., https://generativeai.googleapis.com/...).
  await delay(100); // simulate latency
  const trimmed = opts.prompt.trim();
  return `Gemini(${opts.model}) says: ${trimmed ? trimmed.slice(0, 120) : 'Hello!'} ... [stubbed]`;
}
