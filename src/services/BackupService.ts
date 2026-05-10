// ============================================================
// BackupService — Export/Import with optional AES-GCM-256 encryption
// Per doc 02 §backup and doc 03 §Backup File Format
// Uses Web Crypto API (available in all modern browsers)
// ============================================================

import { db } from '@/db';
import type { BackupData, BackupEnvelope } from '@/types';

const APP_VERSION = '0.1.0';
const SCHEMA_VERSION = 2;
const PBKDF2_ITERATIONS = 100_000;

// ─── Crypto helpers ───────────────────────────────────────

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function sha256Hex(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as unknown as BufferSource, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Data collection ──────────────────────────────────────

async function collectBackupData(): Promise<BackupData> {
  const [users, goals, accounts, goalAllocations, transactions, watchList, settings] =
    await Promise.all([
      db.users.toArray(),
      db.goals.toArray(),
      db.accounts.toArray(),
      db.goalAllocations.toArray(),
      db.transactions.toArray(),
      db.watchList.toArray(),
      db.settings.toArray(),
    ]);

  return { users, goals, accounts, goalAllocations, transactions, watchList, settings };
}

// ─── Export ───────────────────────────────────────────────

/**
 * Export all user data as a BackupEnvelope JSON string.
 * If a password is provided, the data payload is encrypted with AES-GCM-256.
 */
export async function exportBackup(password?: string): Promise<string> {
  const data = await collectBackupData();
  const now = new Date().toISOString();

  if (!password) {
    // Plain-text backup
    const envelope: BackupEnvelope = {
      format: 'investment-platform-backup',
      schemaVersion: SCHEMA_VERSION,
      appVersion: APP_VERSION,
      exportedAt: now,
      encrypted: false,
      data,
    };
    return JSON.stringify(envelope, null, 2);
  }

  // Encrypted backup
  const enc = new TextEncoder();
  const plaintext = enc.encode(JSON.stringify(data));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);

  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  const ciphertextB64 = arrayBufferToBase64(cipherBuf);
  const checksum = await sha256Hex(cipherBuf);

  const envelope: BackupEnvelope = {
    format: 'investment-platform-backup',
    schemaVersion: SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now,
    encrypted: true,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt: arrayBufferToBase64(salt.buffer),
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: ciphertextB64,
    checksum,
  };

  return JSON.stringify(envelope, null, 2);
}

// ─── Import ───────────────────────────────────────────────

/**
 * Parse and validate a backup envelope from JSON.
 * If encrypted, the password is required to decrypt.
 * Returns the extracted BackupData.
 */
export async function parseBackup(json: string, password?: string): Promise<BackupData> {
  const envelope = JSON.parse(json) as BackupEnvelope;

  if (envelope.format !== 'investment-platform-backup') {
    throw new Error('Invalid backup file: unrecognized format');
  }

  if (envelope.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Backup was created with schema v${envelope.schemaVersion} but this app only supports v${SCHEMA_VERSION}. Please update the app.`
    );
  }

  if (!envelope.encrypted) {
    if (!envelope.data) {
      throw new Error('Invalid backup: plain-text backup has no data field');
    }
    return envelope.data;
  }

  // Encrypted — need password
  if (!password) {
    throw new Error('This backup is encrypted. A password is required to restore it.');
  }

  if (!envelope.ciphertext || !envelope.salt || !envelope.iv) {
    throw new Error('Invalid encrypted backup: missing cipher fields');
  }

  const salt = new Uint8Array(base64ToArrayBuffer(envelope.salt));
  const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
  const cipherBuf = base64ToArrayBuffer(envelope.ciphertext);

  // Verify checksum if present
  if (envelope.checksum) {
    const computedChecksum = await sha256Hex(cipherBuf);
    if (computedChecksum !== envelope.checksum) {
      throw new Error('Backup checksum mismatch — file may be corrupted');
    }
  }

  const key = await deriveKey(password, salt);

  let decryptedBuf: ArrayBuffer;
  try {
    decryptedBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuf
    );
  } catch {
    throw new Error('Decryption failed — incorrect password or corrupted file');
  }

  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuf)) as BackupData;
}

/**
 * Restore backup data into IndexedDB.
 * This REPLACES all existing data (clear + re-populate).
 */
export async function restoreBackup(data: BackupData): Promise<void> {
  await db.transaction(
    'rw',
    [db.users, db.goals, db.accounts, db.goalAllocations, db.transactions, db.watchList, db.settings],
    async () => {
      // Clear existing data
      await Promise.all([
        db.users.clear(),
        db.goals.clear(),
        db.accounts.clear(),
        db.goalAllocations.clear(),
        db.transactions.clear(),
        db.watchList.clear(),
        db.settings.clear(),
      ]);

      // Bulk-insert backup data
      await Promise.all([
        db.users.bulkAdd(data.users),
        db.goals.bulkAdd(data.goals),
        db.accounts.bulkAdd(data.accounts),
        db.goalAllocations.bulkAdd(data.goalAllocations),
        db.transactions.bulkAdd(data.transactions),
        db.watchList.bulkAdd(data.watchList),
        db.settings.bulkAdd(data.settings),
      ]);
    }
  );
}

/**
 * Trigger a file download with the given content.
 */
export function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
