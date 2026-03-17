// End-to-end encryption utility for sensitive wallet data (UPI IDs, metadata)
// Uses expo-crypto for key derivation and a stream cipher for encryption
// React Native (Hermes) does NOT support Web Crypto SubtleCrypto — this module
// uses only expo-crypto APIs that work reliably on device
// All encrypted data is stored as base64 strings in the database

import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Key used to store the master encryption key in secure hardware-backed storage
const ENCRYPTION_KEY_ALIAS = 'expense_tracker_encryption_key';

// Retrieve or generate the master encryption key from secure storage
const getOrCreateEncryptionKey = async (): Promise<string> => {
  // Try to load existing key from hardware-backed secure store
  let key = await SecureStore.getItemAsync(ENCRYPTION_KEY_ALIAS);
  if (!key) {
    // Generate a new 256-bit random key and persist it securely
    key = Crypto.randomUUID() + Crypto.randomUUID();
    await SecureStore.setItemAsync(ENCRYPTION_KEY_ALIAS, key);
  }
  return key;
};

// Convert a string to a Uint8Array for crypto operations
const stringToBytes = (str: string): Uint8Array => {
  const encoder = new TextEncoder();
  return encoder.encode(str);
};

// Convert a Uint8Array back to a string
const bytesToString = (bytes: Uint8Array): string => {
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
};

// Convert a Uint8Array to a base64 string for safe storage
const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Convert a base64 string back to Uint8Array for decryption
const base64ToBytes = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

// Derive a key stream using iterated SHA-256 hashing (HKDF-like expansion)
// Produces a pseudo-random byte stream as long as the plaintext for XOR cipher
const deriveKeyStream = async (masterKey: string, salt: Uint8Array, length: number): Promise<Uint8Array> => {
  const stream = new Uint8Array(length);
  let offset = 0;
  let counter = 0;
  // Hash key+salt+counter repeatedly to generate enough key material
  while (offset < length) {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${masterKey}:${bytesToBase64(salt)}:${counter}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    // Convert hex hash to bytes (32 bytes per iteration)
    for (let i = 0; i < hash.length && offset < length; i += 2) {
      stream[offset++] = parseInt(hash.substring(i, i + 2), 16);
    }
    counter++;
  }
  return stream;
};

// Compute an HMAC-like integrity tag using SHA-256(key || data)
const computeIntegrityTag = async (masterKey: string, data: Uint8Array): Promise<Uint8Array> => {
  const tag = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${masterKey}:integrity:${bytesToBase64(data)}`,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
  // Take first 16 bytes (32 hex chars) as the tag
  const tagBytes = new Uint8Array(16);
  for (let i = 0; i < 32; i += 2) {
    tagBytes[i / 2] = parseInt(tag.substring(i, i + 2), 16);
  }
  return tagBytes;
};

// Encrypt a plaintext string and return base64-encoded salt+tag+ciphertext
export const encryptData = async (plaintext: string): Promise<string> => {
  if (!plaintext) return ''; // Nothing to encrypt

  try {
    const masterKey = await getOrCreateEncryptionKey();
    // Generate a random 16-byte salt unique to this encryption
    const salt = Crypto.getRandomValues(new Uint8Array(16));
    const plaintextBytes = stringToBytes(plaintext);

    // Derive a key stream the same length as plaintext
    const keyStream = await deriveKeyStream(masterKey, salt, plaintextBytes.length);

    // XOR plaintext with key stream to produce ciphertext
    const ciphertext = new Uint8Array(plaintextBytes.length);
    for (let i = 0; i < plaintextBytes.length; i++) {
      ciphertext[i] = plaintextBytes[i] ^ keyStream[i];
    }

    // Compute integrity tag over the ciphertext to detect tampering
    const tag = await computeIntegrityTag(masterKey, ciphertext);

    // Pack: salt(16) + tag(16) + ciphertext(N)
    const combined = new Uint8Array(16 + 16 + ciphertext.length);
    combined.set(salt, 0);          // First 16 bytes: random salt
    combined.set(tag, 16);          // Next 16 bytes: integrity tag
    combined.set(ciphertext, 32);   // Rest: encrypted data

    return bytesToBase64(combined);
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
};

// Decrypt a base64-encoded encrypted string back to plaintext
export const decryptData = async (encryptedBase64: string): Promise<string> => {
  if (!encryptedBase64) return ''; // Nothing to decrypt

  try {
    const masterKey = await getOrCreateEncryptionKey();
    // Decode the combined base64 string
    const combined = base64ToBytes(encryptedBase64);

    // Extract salt (first 16 bytes), tag (next 16 bytes), and ciphertext (rest)
    const salt = combined.slice(0, 16);
    const storedTag = combined.slice(16, 32);
    const ciphertext = combined.slice(32);

    // Verify integrity tag before decrypting
    const computedTag = await computeIntegrityTag(masterKey, ciphertext);
    let tagValid = true;
    for (let i = 0; i < 16; i++) {
      if (storedTag[i] !== computedTag[i]) tagValid = false;
    }
    if (!tagValid) {
      throw new Error('Integrity check failed — data may be corrupted');
    }

    // Re-derive the same key stream using the extracted salt
    const keyStream = await deriveKeyStream(masterKey, salt, ciphertext.length);

    // XOR ciphertext with key stream to recover plaintext
    const plaintext = new Uint8Array(ciphertext.length);
    for (let i = 0; i < ciphertext.length; i++) {
      plaintext[i] = ciphertext[i] ^ keyStream[i];
    }

    return bytesToString(plaintext);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
};

// Encrypt a JSON object and return base64-encoded string
export const encryptJSON = async (data: Record<string, any>): Promise<string> => {
  const jsonString = JSON.stringify(data);
  return encryptData(jsonString);
};

// Decrypt a base64-encoded string back to a JSON object
export const decryptJSON = async <T = Record<string, any>>(encryptedBase64: string): Promise<T> => {
  const jsonString = await decryptData(encryptedBase64);
  return JSON.parse(jsonString) as T;
};
