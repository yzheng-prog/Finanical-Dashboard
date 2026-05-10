// ============================================================
// BackupReminder — Dashboard banner prompting users to export
// Shows when: no backup ever, or >50 transactions since last backup
// Per doc SETTING_KEYS: backup.lastBackupAt, backup.transactionsSinceBackup
// ============================================================

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { SETTING_KEYS } from '@/types';
import type { Setting } from '@/types';
import { formatDate } from '@/lib/formatters';

const TX_THRESHOLD = 50;

export function BackupReminder() {
  const { currentUser } = useUserStore();

  const settings = useLiveQuery<Setting[]>(
    () =>
      currentUser
        ? db.settings
            .where('userId')
            .equals(currentUser.id)
            .toArray()
        : Promise.resolve([] as Setting[]),
    [currentUser?.id]
  );

  if (!currentUser || !settings) return null;

  const lastBackupAt = settings.find((s) => s.key === SETTING_KEYS.BACKUP_LAST_AT)?.value;
  const txCountRaw = settings.find((s) => s.key === SETTING_KEYS.BACKUP_TX_COUNT)?.value;
  const snoozeUntil = settings.find((s) => s.key === SETTING_KEYS.BACKUP_SNOOZE_UNTIL)?.value;

  // Check snooze
  if (snoozeUntil) {
    const snoozeDate = JSON.parse(snoozeUntil);
    if (new Date(snoozeDate) > new Date()) return null;
  }

  const txCount = txCountRaw ? JSON.parse(txCountRaw) : 0;
  const neverBackedUp = !lastBackupAt;
  const tooManyTxns = txCount >= TX_THRESHOLD;

  if (!neverBackedUp && !tooManyTxns) return null;

  const handleSnooze = async () => {
    // Snooze for 7 days
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 7);
    const existing = settings?.find((s) => s.key === SETTING_KEYS.BACKUP_SNOOZE_UNTIL);
    if (existing) {
      await db.settings.update(existing.id, {
        value: JSON.stringify(snoozeDate.toISOString()),
        updatedAt: new Date().toISOString(),
      });
    } else {
      await db.settings.add({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        key: SETTING_KEYS.BACKUP_SNOOZE_UNTIL,
        value: JSON.stringify(snoozeDate.toISOString()),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="bg-warning/10 border border-warning/30 rounded-card p-4 flex items-start gap-3">
      <span className="text-lg flex-shrink-0">⚠️</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-maintext">
          {neverBackedUp
            ? "You haven't created a backup yet"
            : `${txCount} transactions since your last backup`}
        </p>
        <p className="text-xs text-subtext mt-0.5">
          {neverBackedUp
            ? 'Your data is stored only in this browser. Export a backup to protect against data loss.'
            : `Last backup: ${formatDate(JSON.parse(lastBackupAt!))}. Go to Settings to export a new backup.`}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <a
          href="/settings"
          className="bg-brand text-white text-xs px-3 py-1.5 rounded-button font-medium hover:bg-brand-dark transition-colors"
        >
          Backup Now
        </a>
        <button
          onClick={handleSnooze}
          className="text-xs text-subtext px-2 py-1.5 hover:text-maintext transition-colors"
        >
          Remind later
        </button>
      </div>
    </div>
  );
}
