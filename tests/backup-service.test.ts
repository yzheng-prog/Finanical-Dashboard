// ============================================================
// BackupService Tests — Export/Import format validation
// Note: Web Crypto (AES-GCM) not available in jsdom/Node without polyfill,
// so encryption tests are skipped. We test the envelope format + plaintext path.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { BackupData, BackupEnvelope } from '../src/types';

// We test parseBackup logic directly by constructing envelopes manually
// rather than going through exportBackup (which hits IndexedDB).

// ─── Helpers ─────────────────────────────────────────────────

function makeBackupData(): BackupData {
  return {
    users: [{
      id: 'u1', name: 'Test User', email: 'test@test.com',
      region: 'CA', baseCurrency: 'CAD', riskProfile: 'moderate',
      assetTier: 'accumulator', createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    } as any],
    goals: [],
    accounts: [],
    goalAllocations: [],
    transactions: [],
    watchList: [],
    settings: [],
  };
}

function makePlainEnvelope(data: BackupData): BackupEnvelope {
  return {
    format: 'investment-platform-backup',
    schemaVersion: 2,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    encrypted: false,
    data,
  };
}

function makeEncryptedEnvelope(): BackupEnvelope {
  return {
    format: 'investment-platform-backup',
    schemaVersion: 2,
    appVersion: '0.1.0',
    exportedAt: new Date().toISOString(),
    encrypted: true,
    cipher: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    salt: 'dGVzdHNhbHQ=', // base64 "testsalt"
    iv: 'dGVzdGl2MTIz',   // base64 "testiv123"
    ciphertext: 'ZW5jcnlwdGVk', // base64 "encrypted"
  };
}

// ─── Group 1: Envelope Validation ────────────────────────────

describe('BackupService — Envelope Format', () => {
  it('BS-01: plain envelope has correct structure', () => {
    const data = makeBackupData();
    const envelope = makePlainEnvelope(data);

    expect(envelope.format).toBe('investment-platform-backup');
    expect(envelope.schemaVersion).toBe(2);
    expect(envelope.encrypted).toBe(false);
    expect(envelope.data).toBeDefined();
    expect(envelope.data!.users).toHaveLength(1);
  });

  it('BS-02: encrypted envelope has cipher metadata', () => {
    const envelope = makeEncryptedEnvelope();

    expect(envelope.encrypted).toBe(true);
    expect(envelope.cipher).toBe('AES-GCM');
    expect(envelope.kdf).toBe('PBKDF2-SHA256');
    expect(envelope.iterations).toBe(100000);
    expect(envelope.salt).toBeTruthy();
    expect(envelope.iv).toBeTruthy();
    expect(envelope.ciphertext).toBeTruthy();
    // Encrypted envelope should NOT have plain data
    expect(envelope.data).toBeUndefined();
  });

  it('BS-03: envelope serializes to valid JSON', () => {
    const data = makeBackupData();
    const envelope = makePlainEnvelope(data);
    const json = JSON.stringify(envelope, null, 2);
    const parsed = JSON.parse(json) as BackupEnvelope;

    expect(parsed.format).toBe('investment-platform-backup');
    expect(parsed.data!.users[0].name).toBe('Test User');
  });

  it('BS-04: schema version tracks correctly', () => {
    const envelope = makePlainEnvelope(makeBackupData());
    expect(envelope.schemaVersion).toBe(2);
    expect(envelope.appVersion).toBe('0.1.0');
  });
});

// ─── Group 2: Parse Validation ───────────────────────────────

describe('BackupService — Parse Logic', () => {
  // Import parseBackup dynamically since it references crypto
  let parseBackup: (json: string, password?: string) => Promise<BackupData>;

  beforeEach(async () => {
    const mod = await import('../src/services/BackupService');
    parseBackup = mod.parseBackup;
  });

  it('BS-05: parseBackup extracts plain data correctly', async () => {
    const data = makeBackupData();
    const envelope = makePlainEnvelope(data);
    const json = JSON.stringify(envelope);

    const result = await parseBackup(json);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].name).toBe('Test User');
    expect(result.goals).toHaveLength(0);
  });

  it('BS-06: rejects invalid format string', async () => {
    const bad = { format: 'wrong-format', schemaVersion: 2, encrypted: false, data: {} };
    await expect(parseBackup(JSON.stringify(bad))).rejects.toThrow('unrecognized format');
  });

  it('BS-07: rejects future schema version', async () => {
    const future = makePlainEnvelope(makeBackupData());
    future.schemaVersion = 99;
    await expect(parseBackup(JSON.stringify(future))).rejects.toThrow('schema v99');
  });

  it('BS-08: rejects plain envelope with no data', async () => {
    const noData: any = {
      format: 'investment-platform-backup',
      schemaVersion: 2,
      encrypted: false,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      // no data field
    };
    await expect(parseBackup(JSON.stringify(noData))).rejects.toThrow('no data');
  });

  it('BS-09: encrypted backup without password throws', async () => {
    const enc = makeEncryptedEnvelope();
    await expect(parseBackup(JSON.stringify(enc))).rejects.toThrow('password is required');
  });

  it('BS-10: invalid JSON throws', async () => {
    await expect(parseBackup('not json at all {')).rejects.toThrow();
  });
});

// ─── Group 3: BackupData Completeness ────────────────────────

describe('BackupService — Data Completeness', () => {
  it('BS-11: BackupData has all required table arrays', () => {
    const data = makeBackupData();
    expect(Array.isArray(data.users)).toBe(true);
    expect(Array.isArray(data.goals)).toBe(true);
    expect(Array.isArray(data.accounts)).toBe(true);
    expect(Array.isArray(data.goalAllocations)).toBe(true);
    expect(Array.isArray(data.transactions)).toBe(true);
    expect(Array.isArray(data.watchList)).toBe(true);
    expect(Array.isArray(data.settings)).toBe(true);
  });

  it('BS-12: round-trip plain envelope preserves all data', async () => {
    const data = makeBackupData();
    data.goals = [{ id: 'g1', name: 'Retirement', userId: 'u1' } as any];
    data.accounts = [{ id: 'a1', userId: 'u1', type: 'TFSA' } as any];

    const envelope = makePlainEnvelope(data);
    const json = JSON.stringify(envelope);
    const { parseBackup } = await import('../src/services/BackupService');
    const result = await parseBackup(json);

    expect(result.users).toHaveLength(1);
    expect(result.goals).toHaveLength(1);
    expect(result.goals[0].name).toBe('Retirement');
    expect(result.accounts).toHaveLength(1);
    expect(result.accounts[0].type).toBe('TFSA');
  });
});
