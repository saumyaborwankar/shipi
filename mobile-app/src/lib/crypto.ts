import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
  CryptoDigestAlgorithm,
  digest,
  digestStringAsync,
  getRandomBytes,
} from 'expo-crypto';
import type { Envelope } from './types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function generateVaultKey(): Uint8Array {
  return getRandomBytes(32);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return out;
}

export async function keyFingerprint(key: Uint8Array): Promise<string> {
  const hash = await digest(CryptoDigestAlgorithm.SHA256, new Uint8Array(key));
  return toHex(hash);
}

export async function sha256Text(text: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, text);
}

export async function encryptText(key: Uint8Array, plaintext: string): Promise<Envelope> {
  const aesKey = await AESEncryptionKey.import(key);
  const sealed = await aesEncryptAsync(encoder.encode(plaintext), aesKey);
  const [iv, authTag, data] = await Promise.all([
    sealed.iv('base64'),
    sealed.tag('base64'),
    sealed.ciphertext({ encoding: 'base64', includeTag: false }),
  ]);
  return { iv, authTag, data };
}

export async function decryptText(key: Uint8Array, envelope: Envelope): Promise<string> {
  const aesKey = await AESEncryptionKey.import(key);
  const sealed = AESSealedData.fromParts(envelope.iv, envelope.data, envelope.authTag);
  const bytes = await aesDecryptAsync(sealed, aesKey, { output: 'bytes' });
  return decoder.decode(bytes);
}
