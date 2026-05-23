import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { env } from './env';

// AES-256-GCM. Formato: <iv_hex>:<tag_hex>:<ciphertext_hex>
const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12;

function getKey(): Buffer {
  return Buffer.from(env().ENCRYPTION_KEY, 'hex');
}

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${ciphertext.toString('hex')}`;
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, ctHex] = payload.split(':');
  if (!ivHex || !tagHex || !ctHex) {
    throw new Error('Payload cifrado con formato inválido');
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]);
  return plain.toString('utf8');
}
