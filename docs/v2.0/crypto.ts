/**
 * Envelope Encryption Library — EMS V.2.0 PII Vault
 *
 * Architecture:
 *   KEK (Key Encryption Key)  — master key, stored in Synology Encrypted Folder
 *                                loaded once at boot, never written to disk by app
 *   DEK (Data Encryption Key) — per-record key, AES-256-GCM
 *                                stored as `wrappedDek` in Vault DB (encrypted with KEK)
 *   AES-256-GCM               — authenticated encryption for PII fields
 *   HMAC-SHA256 + pepper       — deterministic search hash for phone/email
 *
 * No external dependencies — uses Node.js built-in `node:crypto`.
 *
 * Storage format (Buffer):
 *   [IV: 12 bytes][AUTH_TAG: 16 bytes][CIPHERTEXT: variable]
 */

import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHmac,
} from 'node:crypto';

// ───────────────────────────────────────────────
// Constants
// ───────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const KEY_SIZE = 32; // 256 bits
const IV_SIZE = 12;  // 96 bits — recommended for GCM
const TAG_SIZE = 16; // 128 bits — GCM auth tag

// ───────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────
export type Key = Buffer;
export type EncryptedBlob = Buffer;
export type WrappedKey = Buffer;

export interface EnvelopeCiphertext {
  ciphertext: EncryptedBlob;
  wrappedDek: WrappedKey;
}

// ───────────────────────────────────────────────
// Key generation
// ───────────────────────────────────────────────

/** Generate a fresh 256-bit symmetric key. Use for KEK (once) or DEK (per record). */
export function generateKey(): Key {
  return randomBytes(KEY_SIZE);
}

/** Generate a 32-byte search pepper. Stored in env, never rotates lightly. */
export function generatePepper(): Buffer {
  return randomBytes(32);
}

// ───────────────────────────────────────────────
// Core: AES-256-GCM
// ───────────────────────────────────────────────

/**
 * Encrypt plaintext under the given key.
 * Returns Buffer: [IV | TAG | CIPHERTEXT]
 */
export function encrypt(plaintext: string | Buffer, key: Key): EncryptedBlob {
  if (key.length !== KEY_SIZE) {
    throw new Error(`Invalid key size: expected ${KEY_SIZE}, got ${key.length}`);
  }

  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const data = typeof plaintext === 'string' ? Buffer.from(plaintext, 'utf8') : plaintext;
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, ciphertext]);
}

/**
 * Decrypt a blob produced by `encrypt`. Throws if tampered (auth tag mismatch).
 */
export function decrypt(blob: EncryptedBlob, key: Key): string {
  if (key.length !== KEY_SIZE) {
    throw new Error(`Invalid key size: expected ${KEY_SIZE}, got ${key.length}`);
  }
  if (blob.length < IV_SIZE + TAG_SIZE) {
    throw new Error('Encrypted blob too short');
  }

  const iv = blob.subarray(0, IV_SIZE);
  const tag = blob.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
  const ciphertext = blob.subarray(IV_SIZE + TAG_SIZE);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

// ───────────────────────────────────────────────
// Envelope: wrap/unwrap DEK with KEK
// ───────────────────────────────────────────────

/** Encrypt a DEK with the KEK. Safe to store alongside ciphertext. */
export function wrapKey(dek: Key, kek: Key): WrappedKey {
  return encrypt(dek, kek);
}

/** Recover a DEK from its wrapped form using the KEK. */
export function unwrapKey(wrapped: WrappedKey, kek: Key): Key {
  if (kek.length !== KEY_SIZE) {
    throw new Error(`Invalid KEK size: expected ${KEY_SIZE}, got ${kek.length}`);
  }
  if (wrapped.length !== IV_SIZE + TAG_SIZE + KEY_SIZE) {
    throw new Error('Invalid wrapped key size');
  }

  const iv = wrapped.subarray(0, IV_SIZE);
  const tag = wrapped.subarray(IV_SIZE, IV_SIZE + TAG_SIZE);
  const ciphertext = wrapped.subarray(IV_SIZE + TAG_SIZE);

  const decipher = createDecipheriv(ALGORITHM, kek, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// ───────────────────────────────────────────────
// Search hash (HMAC-SHA256 with pepper)
// ───────────────────────────────────────────────

/**
 * Deterministic search hash for fields like phone/email.
 * Same value + same pepper → same hash → DB lookup without decryption.
 *
 * Pepper is a SECRET — leaking pepper enables brute-force on common values.
 * Treat pepper with the same care as KEK.
 *
 * Input is normalized (NFC, trim, lowercase) so "0812345678" and "  0812345678  "
 * produce the same hash.
 */
export function searchHash(value: string, pepper: Buffer): string {
  return createHmac('sha256', pepper)
    .update(value.normalize('NFC').trim().toLowerCase())
    .digest('hex');
}

// ───────────────────────────────────────────────
// High-level: per-field envelope encrypt/decrypt
// ───────────────────────────────────────────────

/**
 * Encrypt a single PII field with a fresh DEK + wrap the DEK with KEK.
 * Caller stores both `ciphertext` and `wrappedDek` in the Vault DB.
 *
 * For multi-field records, prefer `encryptRecord` (one DEK for many fields).
 */
export function encryptField(plaintext: string, kek: Key): EnvelopeCiphertext {
  const dek = generateKey();
  const ciphertext = encrypt(plaintext, dek);
  const wrappedDek = wrapKey(dek, kek);
  dek.fill(0);
  return { ciphertext, wrappedDek };
}

export function decryptField(envelope: EnvelopeCiphertext, kek: Key): string {
  const dek = unwrapKey(envelope.wrappedDek, kek);
  try {
    return decrypt(envelope.ciphertext, dek);
  } finally {
    dek.fill(0);
  }
}

/**
 * Encrypt multiple PII fields under ONE shared DEK (per-record).
 * This is the recommended pattern for the `identities` table: one wrappedDek
 * per row, multiple encrypted fields all use the same DEK.
 */
export function encryptRecord<T extends Record<string, string | null | undefined>>(
  fields: T,
  kek: Key,
): { encrypted: { [K in keyof T]: EncryptedBlob | null }; wrappedDek: WrappedKey } {
  const dek = generateKey();
  const wrappedDek = wrapKey(dek, kek);

  const encrypted = {} as { [K in keyof T]: EncryptedBlob | null };
  for (const k of Object.keys(fields) as (keyof T)[]) {
    const v = fields[k];
    encrypted[k] = v == null ? null : encrypt(v, dek);
  }

  dek.fill(0);
  return { encrypted, wrappedDek };
}

export function decryptRecord<K extends string>(
  encrypted: Record<K, EncryptedBlob | null>,
  wrappedDek: WrappedKey,
  kek: Key,
): Record<K, string | null> {
  const dek = unwrapKey(wrappedDek, kek);
  try {
    const out = {} as Record<K, string | null>;
    for (const k of Object.keys(encrypted) as K[]) {
      const blob = encrypted[k];
      out[k] = blob == null ? null : decrypt(blob, dek);
    }
    return out;
  } finally {
    dek.fill(0);
  }
}

// ───────────────────────────────────────────────
// Crypto-shredding (PDPA right-to-erasure)
// ───────────────────────────────────────────────

/**
 * Destroy the DEK while keeping ciphertext. After this, the record is
 * permanently unrecoverable — but database integrity (FKs, audit log) is
 * preserved.
 *
 * Caller is responsible for persisting the empty wrappedDek to DB and
 * recording the shred event in the audit log.
 */
export function cryptoShred(envelope: EnvelopeCiphertext): EnvelopeCiphertext {
  return {
    ciphertext: envelope.ciphertext,
    wrappedDek: Buffer.alloc(0),
  };
}

export function isShredded(envelope: { wrappedDek: WrappedKey }): boolean {
  return envelope.wrappedDek.length === 0;
}

// ───────────────────────────────────────────────
// Key loading (for app boot)
// ───────────────────────────────────────────────

/**
 * Load KEK from a base64-encoded environment variable.
 * Throws if missing or wrong size — fail-fast at boot, do not start without a key.
 */
export function loadKekFromEnv(envName = 'VAULT_KEK_BASE64'): Key {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`Missing ${envName} — KEK must be set at boot`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_SIZE) {
    throw new Error(`${envName} must decode to ${KEY_SIZE} bytes, got ${key.length}`);
  }
  return key;
}

/**
 * Load pepper from env (base64).
 */
export function loadPepperFromEnv(envName = 'VAULT_SEARCH_PEPPER_BASE64'): Buffer {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`Missing ${envName} — search pepper must be set at boot`);
  }
  const pepper = Buffer.from(raw, 'base64');
  if (pepper.length < 16) {
    throw new Error(`${envName} pepper too short (got ${pepper.length} bytes, need ≥ 16)`);
  }
  return pepper;
}
