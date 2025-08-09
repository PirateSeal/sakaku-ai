# Feature Requirements Spec – Discord `/ask` Command (Gemini-backed Bot)

## Goal
- Provide Discord users with a `/ask` slash command that sends a prompt to a Gemini model and returns an answer or error message.
- Ensure interaction is responsive, reliable, and secure while respecting platform and infrastructure limits.

## Non-Goals
- No fine-tuning or custom training of Gemini.
- No cross-guild conversation memory or per-user long-term state.
- No audio, image, or file processing. Text only.

## User Story
- *As a* Discord user
- *I want* to run `/ask question:<text>`
- *So that* I receive a concise AI-generated answer in the channel I invoked it.

## Inputs
- Required: `question` (string ≤ 250 chars).
- Optional: `private` (boolean; default false).
- Derived: `user_id`, `channel_id`, `guild_id`, `timestamp`.

## Outputs
- Success: Message (ephemeral if `private=true`) containing Gemini’s answer ≤ 1,000 chars.
- Error: User-visible error message with reason (timeout, model error, or validation failure).
- Logged metadata (guild, user, latency, outcome).

## Constraints
1. **Discord 3 s rule**
    - Bot must acknowledge slash command (defer or reply) within 3 s.
2. **AWS Lambda execution**
    - Cold start + processing must finish in 10–15 s; otherwise, respond with timeout error.
3. Request size ≤ 1 MB; response size ≤ 6 MB per Discord limits.
4. Rate limit: respect Gemini and Discord quotas; throttle locally if needed.
5. All processing must comply with company security and privacy policies.

## Acceptance Criteria
1. When a valid `/ask` request is issued, the bot sends an initial ACK within 3 s (automated integration test).
2. For prompts that Gemini answers within 10 s, the bot posts the answer message, and `latency ≤ 12 s` end-to-end measured in logs.
3. If Gemini or Lambda exceeds 15 s, the bot edits the deferred message with “Timeout: please try again” within 1 s of Lambda termination.
4. Invalid input (>250 chars or empty) returns “Invalid question” without hitting Gemini.
5. When `private=true`, responses are ephemeral and visible only to requester; when false, response is public in channel.
6. Log entry exists for every invocation with `status ∈ {success, timeout, error}` and correct metadata fields.
7. Unit tests cover input validation and output formatting; integration tests mock Gemini to confirm responses and timeouts.