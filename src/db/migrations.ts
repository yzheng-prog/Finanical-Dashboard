// ============================================================
// Dexie Migration Logic
// v1 → v2: add goalAllocations + holdingsSnapshots tables,
//            add settlementDate to transactions,
//            reclassify legacy 'dividend' txns in NonReg/USD_NonReg accounts
// ============================================================

import type Dexie from 'dexie';

/**
 * Called by Dexie upgrade handler for v1 → v2.
 * Runs inside an IndexedDB transaction — any failure auto-rolls back.
 */
export async function migrateV1toV2(db: Dexie): Promise<void> {
  // 1. Populate settlementDate for legacy transactions where it's missing.
  //    CRA guidance: use trade date as settlement date when unknown.
  const txns = await db.table('transactions').toArray();
  const updates = txns
    .filter((t) => !t.settlementDate)
    .map((t) => ({ key: t.id, changes: { settlementDate: t.executedAt } }));

  if (updates.length > 0) {
    await db.table('transactions').bulkUpdate(
      updates.map(({ key, changes }) => ({ key, changes }))
    );
  }

  // 2. Best-effort reclassification: 'dividend' in NonRegistered or USD_NonReg accounts
  //    → 'eligible_dividend' as the most common case.
  //    Users can re-classify individually in the UI if incorrect.
  const accounts = await db.table('accounts').toArray();
  const nonRegAccountIds = new Set(
    accounts
      .filter((a) => a.type === 'NonRegistered' || a.type === 'USD_NonReg')
      .map((a) => a.id)
  );

  if (nonRegAccountIds.size > 0) {
    const dividendTxns = txns.filter(
      (t) => t.type === 'dividend' && nonRegAccountIds.has(t.accountId)
    );

    if (dividendTxns.length > 0) {
      await db.table('transactions').bulkUpdate(
        dividendTxns.map((t) => ({ key: t.id, changes: { type: 'eligible_dividend' } }))
      );
    }
  }

  // goalAllocations and holdingsSnapshots tables are created automatically
  // by Dexie when the new schema is applied — no data seeding needed.
}
