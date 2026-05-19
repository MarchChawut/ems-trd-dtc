/**
 * Validation tests for crypto.ts
 *
 * Uses Node.js built-in test runner — no extra dependencies required.
 *
 * Run:
 *   npx tsx --test docs/v2.0/crypto.test.ts
 *
 * Expected output: all tests pass, no warnings.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  generateKey,
  generatePepper,
  encrypt,
  decrypt,
  wrapKey,
  unwrapKey,
  searchHash,
  encryptField,
  decryptField,
  encryptRecord,
  decryptRecord,
  cryptoShred,
  isShredded,
  loadKekFromEnv,
  loadPepperFromEnv,
} from './crypto.ts';

// ─────────────────────────────────────
// AES-256-GCM
// ─────────────────────────────────────

test('encrypt → decrypt round-trip preserves plaintext', () => {
  const key = generateKey();
  const plaintext = 'นาย สมชาย ใจดี';
  const blob = encrypt(plaintext, key);
  assert.equal(decrypt(blob, key), plaintext);
});

test('encrypt → decrypt handles ASCII, Thai, emoji', () => {
  const key = generateKey();
  for (const p of ['plain ascii', 'ไทย ๆ', '🇹🇭👨‍💻', '081-234-5678', '']) {
    const blob = encrypt(p, key);
    assert.equal(decrypt(blob, key), p);
  }
});

test('decrypt with wrong key throws', () => {
  const k1 = generateKey();
  const k2 = generateKey();
  const blob = encrypt('secret', k1);
  assert.throws(() => decrypt(blob, k2));
});

test('decrypt of tampered ciphertext throws (auth tag verification)', () => {
  const key = generateKey();
  const blob = encrypt('081-234-5678', key);
  blob[blob.length - 1] ^= 0xff; // flip last byte
  assert.throws(() => decrypt(blob, key));
});

test('decrypt of tampered IV throws', () => {
  const key = generateKey();
  const blob = encrypt('081-234-5678', key);
  blob[0] ^= 0xff; // flip IV byte
  assert.throws(() => decrypt(blob, key));
});

test('encrypt is non-deterministic (random IV)', () => {
  const key = generateKey();
  const a = encrypt('hello', key);
  const b = encrypt('hello', key);
  assert.notDeepEqual(a, b);
});

test('encrypt rejects wrong-size key', () => {
  const badKey = Buffer.alloc(16); // 128-bit, not 256
  assert.throws(() => encrypt('x', badKey));
});

test('decrypt rejects truncated blob', () => {
  const key = generateKey();
  assert.throws(() => decrypt(Buffer.alloc(10), key));
});

test('encrypt accepts Buffer plaintext', () => {
  const key = generateKey();
  const data = Buffer.from('ทดสอบไบนารี', 'utf8');
  const blob = encrypt(data, key);
  assert.equal(decrypt(blob, key), 'ทดสอบไบนารี');
});

// ─────────────────────────────────────
// Envelope (wrap / unwrap)
// ─────────────────────────────────────

test('wrapKey → unwrapKey round-trip preserves DEK', () => {
  const kek = generateKey();
  const dek = generateKey();
  const wrapped = wrapKey(dek, kek);
  const unwrapped = unwrapKey(wrapped, kek);
  assert.deepEqual(unwrapped, dek);
});

test('unwrapKey with wrong KEK throws', () => {
  const kek1 = generateKey();
  const kek2 = generateKey();
  const dek = generateKey();
  const wrapped = wrapKey(dek, kek1);
  assert.throws(() => unwrapKey(wrapped, kek2));
});

test('unwrapKey rejects malformed wrapped key', () => {
  const kek = generateKey();
  assert.throws(() => unwrapKey(Buffer.alloc(5), kek));
});

// ─────────────────────────────────────
// Field-level convenience
// ─────────────────────────────────────

test('encryptField / decryptField envelope round-trip', () => {
  const kek = generateKey();
  const env = encryptField('นางสาว มาลี รักดี', kek);
  assert.equal(decryptField(env, kek), 'นางสาว มาลี รักดี');
});

test('encryptField uses a fresh DEK each call', () => {
  const kek = generateKey();
  const a = encryptField('same', kek);
  const b = encryptField('same', kek);
  assert.notDeepEqual(a.wrappedDek, b.wrappedDek);
  assert.notDeepEqual(a.ciphertext, b.ciphertext);
});

// ─────────────────────────────────────
// Record-level (multi-field, one DEK)
// ─────────────────────────────────────

test('encryptRecord / decryptRecord multi-field round-trip', () => {
  const kek = generateKey();
  const original = {
    name: 'สมชาย',
    surname: 'ใจดี',
    phone: '0812345678',
    birthday: '1989-05-19',
    email: null,
  };
  const { encrypted, wrappedDek } = encryptRecord(original, kek);
  const decrypted = decryptRecord(encrypted, wrappedDek, kek);

  assert.equal(decrypted.name, 'สมชาย');
  assert.equal(decrypted.surname, 'ใจดี');
  assert.equal(decrypted.phone, '0812345678');
  assert.equal(decrypted.birthday, '1989-05-19');
  assert.equal(decrypted.email, null);
});

test('encryptRecord preserves null fields', () => {
  const kek = generateKey();
  const { encrypted } = encryptRecord({ phone: null, name: 'X' }, kek);
  assert.equal(encrypted.phone, null);
  assert.ok(encrypted.name);
});

// ─────────────────────────────────────
// Search hash
// ─────────────────────────────────────

test('searchHash is deterministic for same input + pepper', () => {
  const pepper = generatePepper();
  assert.equal(searchHash('0812345678', pepper), searchHash('0812345678', pepper));
});

test('searchHash normalizes whitespace and case', () => {
  const pepper = generatePepper();
  assert.equal(
    searchHash('user@example.com', pepper),
    searchHash('  USER@example.com  ', pepper),
  );
});

test('searchHash differs for different inputs', () => {
  const pepper = generatePepper();
  assert.notEqual(searchHash('a', pepper), searchHash('b', pepper));
});

test('searchHash differs for same input under different peppers', () => {
  const p1 = generatePepper();
  const p2 = generatePepper();
  assert.notEqual(searchHash('same', p1), searchHash('same', p2));
});

test('searchHash output is 64-char hex', () => {
  const pepper = generatePepper();
  const h = searchHash('x', pepper);
  assert.equal(h.length, 64);
  assert.match(h, /^[0-9a-f]{64}$/);
});

// ─────────────────────────────────────
// Crypto-shredding (PDPA right-to-erasure)
// ─────────────────────────────────────

test('cryptoShred makes ciphertext unrecoverable', () => {
  const kek = generateKey();
  const env = encryptField('sensitive', kek);
  const shredded = cryptoShred(env);
  assert.equal(isShredded(shredded), true);
  assert.throws(() => decryptField(shredded, kek));
});

test('non-shredded envelope reports as not shredded', () => {
  const kek = generateKey();
  const env = encryptField('data', kek);
  assert.equal(isShredded(env), false);
});

test('cryptoShred preserves ciphertext bytes (audit reference)', () => {
  const kek = generateKey();
  const env = encryptField('x', kek);
  const shredded = cryptoShred(env);
  assert.deepEqual(shredded.ciphertext, env.ciphertext);
});

// ─────────────────────────────────────
// Env loading (boot-time)
// ─────────────────────────────────────

test('loadKekFromEnv reads valid base64 KEK', () => {
  const key = generateKey();
  process.env.TEST_KEK = key.toString('base64');
  const loaded = loadKekFromEnv('TEST_KEK');
  assert.deepEqual(loaded, key);
  delete process.env.TEST_KEK;
});

test('loadKekFromEnv throws on missing env', () => {
  delete process.env.MISSING_KEY;
  assert.throws(() => loadKekFromEnv('MISSING_KEY'));
});

test('loadKekFromEnv throws on wrong size', () => {
  process.env.BAD_KEK = Buffer.alloc(16).toString('base64');
  assert.throws(() => loadKekFromEnv('BAD_KEK'));
  delete process.env.BAD_KEK;
});

test('loadPepperFromEnv accepts pepper ≥ 16 bytes', () => {
  process.env.TEST_PEPPER = generatePepper().toString('base64');
  const p = loadPepperFromEnv('TEST_PEPPER');
  assert.ok(p.length >= 16);
  delete process.env.TEST_PEPPER;
});

test('loadPepperFromEnv rejects too-short pepper', () => {
  process.env.SHORT_PEPPER = Buffer.alloc(8).toString('base64');
  assert.throws(() => loadPepperFromEnv('SHORT_PEPPER'));
  delete process.env.SHORT_PEPPER;
});
