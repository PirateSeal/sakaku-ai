import { describe, expect, it } from 'vitest'
import { verifyDiscordRequest } from './verify'

describe('verifyDiscordRequest', () => {
  it('fails for invalid inputs', () => {
    expect(verifyDiscordRequest('00', '00', '0', 'test')).toBe(false)
  })
})
