// ============================================================
// SettingsPage — Data Management: Export/Import with optional AES-GCM encryption
// Per doc 04 §11 backup UI + doc 02 §backup spec
// ============================================================

import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { exportBackup, parseBackup, restoreBackup, downloadFile } from '@/services/BackupService';
import { SETTING_KEYS } from '@/types';
import type { Setting } from '@/types';
import { formatDate } from '@/lib/formatters';
import { SnapshotService } from '@/services/SnapshotService';
import { HoldingsService } from '@/services/HoldingsService';
import { useUserStore } from '@/stores/userStore';
import { AccountRepository, HoldingRepository, TransactionRepository, SnapshotRepository } from '@/repositories';

const snapshotRepo = new SnapshotRepository();
const holdingRepo = new HoldingRepository();
const txnRepo = new TransactionRepository();
const accountRepo = new AccountRepository();

type Status = { type: 'idle' } | { type: 'loading'; message: string } | { type: 'success'; message: string } | { type: 'error'; message: string };

export function SettingsPage() {
  const { currentUser } = useUserStore();
  const [status, setStatus] = useState<Status>({ type: 'idle' });
  const [showEncrypt, setShowEncrypt] = useState(false);
  const [password, setPassword] = useState('');
  const [importPassword, setImportPassword] = useState('');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live query for backup settings
  const backupSettings = useLiveQuery<Setting[]>(
    () => currentUser
      ? db.settings.where('userId').equals(currentUser.id).toArray()
      : Promise.resolve([] as Setting[]),
    [currentUser?.id]
  );

  const lastBackupAt = backupSettings?.find((s) => s.key === SETTING_KEYS.BACKUP_LAST_AT)?.value;
  const txSinceBackup = backupSettings?.find((s) => s.key === SETTING_KEYS.BACKUP_TX_COUNT)?.value;

  // Helper: record backup timestamp in settings
  const recordBackupTimestamp = async () => {
    if (!currentUser) return;
    const now = new Date().toISOString();
    const existing = backupSettings?.find((s) => s.key === SETTING_KEYS.BACKUP_LAST_AT);
    if (existing) {
      await db.settings.update(existing.id, { value: JSON.stringify(now), updatedAt: now });
    } else {
      await db.settings.add({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        key: SETTING_KEYS.BACKUP_LAST_AT,
        value: JSON.stringify(now),
        updatedAt: now,
      });
    }
    // Reset transaction counter
    const txCountSetting = backupSettings?.find((s) => s.key === SETTING_KEYS.BACKUP_TX_COUNT);
    if (txCountSetting) {
      await db.settings.update(txCountSetting.id, { value: JSON.stringify(0), updatedAt: now });
    }
  };

  const handleExport = async (encrypted: boolean) => {
    setStatus({ type: 'loading', message: 'Exporting data…' });
    try {
      const json = await exportBackup(encrypted ? password : undefined);
      const timestamp = new Date().toISOString().slice(0, 10);
      const suffix = encrypted ? '-encrypted' : '';
      downloadFile(json, `investca-backup-${timestamp}${suffix}.json`);
      await recordBackupTimestamp();
      setStatus({ type: 'success', message: 'Backup exported successfully!' });
      setShowEncrypt(false);
      setPassword('');
    } catch (err) {
      setStatus({ type: 'error', message: `Export failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus({ type: 'loading', message: 'Reading backup file…' });
    try {
      const json = await file.text();
      const parsed = JSON.parse(json);

      // Check if encrypted and needs password
      if (parsed.encrypted && !importPassword) {
        setShowImportPassword(true);
        setStatus({ type: 'idle' });
        // Store file content for re-use after password entry
        fileInputRef.current?.setAttribute('data-json', json);
        return;
      }

      const data = await parseBackup(json, parsed.encrypted ? importPassword : undefined);

      if (!confirm('This will REPLACE all existing data. Are you sure?')) {
        setStatus({ type: 'idle' });
        return;
      }

      await restoreBackup(data);
      setStatus({ type: 'success', message: 'Backup restored successfully! Reloading…' });
      setShowImportPassword(false);
      setImportPassword('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setStatus({ type: 'error', message: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }

    // Reset file input so same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImportWithPassword = async () => {
    const json = fileInputRef.current?.getAttribute('data-json');
    if (!json) {
      setStatus({ type: 'error', message: 'No file loaded. Please select the backup file again.' });
      return;
    }

    setStatus({ type: 'loading', message: 'Decrypting backup…' });
    try {
      const data = await parseBackup(json, importPassword);

      if (!confirm('This will REPLACE all existing data. Are you sure?')) {
        setStatus({ type: 'idle' });
        return;
      }

      await restoreBackup(data);
      setStatus({ type: 'success', message: 'Backup restored successfully! Reloading…' });
      setShowImportPassword(false);
      setImportPassword('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err) {
      setStatus({ type: 'error', message: `Import failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  };

  const handleRebuildSnapshots = async () => {
    if (!currentUser) return;
    setStatus({ type: 'loading', message: 'Rebuilding snapshots & holdings…' });
    try {
      const accounts = await accountRepo.getAll(currentUser.id);
      const accountIds = accounts.map((a) => a.id);

      const snapshotService = new SnapshotService(txnRepo, snapshotRepo);
      for (const accountId of accountIds) {
        await snapshotService.rebuildAll(accountId);
      }

      const holdingsService = new HoldingsService(txnRepo, holdingRepo, snapshotRepo);
      await holdingsService.rebuildAllHoldings(currentUser.id, accountIds);

      setStatus({ type: 'success', message: 'Snapshots and holdings rebuilt successfully!' });
    } catch (err) {
      setStatus({ type: 'error', message: `Rebuild failed: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  };

  return (
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold text-maintext">Settings</h1>

      {/* Status banner */}
      {status.type !== 'idle' && (
        <div className={`rounded-input px-4 py-3 text-sm ${
          status.type === 'loading' ? 'bg-info/10 text-info border border-info/30' :
          status.type === 'success' ? 'bg-gain/10 text-gain border border-gain/30' :
          'bg-loss/10 text-loss border border-loss/30'
        }`}>
          {status.type === 'loading' && <span className="inline-block animate-spin mr-2">⏳</span>}
          {status.message}
        </div>
      )}

      {/* Backup section */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="text-base font-semibold text-maintext mb-1">Data Management</h2>
        <p className="text-sm text-subtext mb-4">
          Your data is stored locally in this browser. Export regularly to prevent data loss.
        </p>

        {/* Backup status summary */}
        <div className="bg-surface rounded-input px-4 py-3 mb-4 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-subtext">Last backup:</span>
            <span className="font-medium text-maintext">
              {lastBackupAt ? formatDate(JSON.parse(lastBackupAt)) : 'Never'}
            </span>
          </div>
          {txSinceBackup && (
            <div className="flex justify-between items-center mt-1">
              <span className="text-subtext">Transactions since:</span>
              <span className="font-medium text-maintext">{JSON.parse(txSinceBackup)}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {/* Export — plain */}
          <button
            onClick={() => handleExport(false)}
            disabled={status.type === 'loading'}
            className="w-full border border-border text-maintext px-4 py-2.5 rounded-button text-sm font-medium hover:bg-divider transition-colors text-left disabled:opacity-60"
          >
            📥 Export Backup (Plain JSON)
          </button>

          {/* Export — encrypted */}
          {!showEncrypt ? (
            <button
              onClick={() => setShowEncrypt(true)}
              disabled={status.type === 'loading'}
              className="w-full border border-border text-maintext px-4 py-2.5 rounded-button text-sm font-medium hover:bg-divider transition-colors text-left disabled:opacity-60"
            >
              🔒 Export Encrypted Backup
            </button>
          ) : (
            <div className="border border-border rounded-input p-3 space-y-2">
              <label className="block text-sm font-medium text-maintext">Enter encryption password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (remember this!)"
                className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <p className="text-xs text-subtext">
                AES-GCM-256 encryption. If you forget this password, the backup cannot be restored.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExport(true)}
                  disabled={!password || status.type === 'loading'}
                  className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
                >
                  Export Encrypted
                </button>
                <button
                  onClick={() => { setShowEncrypt(false); setPassword(''); }}
                  className="border border-border text-maintext px-4 py-2 rounded-button text-sm font-medium hover:bg-divider transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Import */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleImportClick}
            disabled={status.type === 'loading'}
            className="w-full border border-border text-maintext px-4 py-2.5 rounded-button text-sm font-medium hover:bg-divider transition-colors text-left disabled:opacity-60"
          >
            📤 Import Backup
          </button>

          {/* Password prompt for encrypted import */}
          {showImportPassword && (
            <div className="border border-border rounded-input p-3 space-y-2">
              <label className="block text-sm font-medium text-maintext">This backup is encrypted. Enter password:</label>
              <input
                type="password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="Backup password"
                className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleImportWithPassword}
                  disabled={!importPassword || status.type === 'loading'}
                  className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
                >
                  Decrypt & Import
                </button>
                <button
                  onClick={() => { setShowImportPassword(false); setImportPassword(''); }}
                  className="border border-border text-maintext px-4 py-2 rounded-button text-sm font-medium hover:bg-divider transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rebuild snapshots */}
          <button
            onClick={handleRebuildSnapshots}
            disabled={status.type === 'loading' || !currentUser}
            className="w-full border border-border text-maintext px-4 py-2.5 rounded-button text-sm font-medium hover:bg-divider transition-colors text-left disabled:opacity-60"
          >
            🔄 Rebuild Snapshots & Holdings
          </button>
        </div>
      </div>

      {/* App info */}
      <div className="bg-white rounded-card shadow-card p-6">
        <h2 className="text-base font-semibold text-maintext mb-1">App Info</h2>
        <div className="text-sm text-subtext space-y-1">
          <p>Version: 0.1.0 (Phase 1)</p>
          <p>Database schema: v2</p>
          <p>Storage: IndexedDB (local)</p>
        </div>
      </div>
    </div>
  );
}
