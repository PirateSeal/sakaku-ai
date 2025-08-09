
import nacl from 'tweetnacl';

/**
 * Verify Discord request using Ed25519.
 * @param publicKey hex-encoded public key from Discord
 * @param signature header 'X-Signature-Ed25519' (hex)
 * @param timestamp header 'X-Signature-Timestamp' (string)
 * @param body raw request body string
 */
export function verifyDiscordRequest(publicKey: string, signature: string, timestamp: string, body: string): boolean {
  try {
    const message = new TextEncoder().encode(timestamp + body);
    const sig = hexToUint8Array(signature);
    const pk = hexToUint8Array(publicKey);
    return nacl.sign.detached.verify(message, sig, pk);
  } catch {
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
}
