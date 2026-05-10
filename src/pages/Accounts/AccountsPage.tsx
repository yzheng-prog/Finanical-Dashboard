// ============================================================
// AccountsPage — Account CRUD per doc 04 §6.2 (top tabs: account types)
// Supports 6 account types: TFSA/RRSP/FHSA/NonReg/USD_NonReg/CryptoWallet
// Each account binds to exactly one Goal (Plan A per doc 03)
// ============================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { AccountSchema, type AccountFormData } from '@/lib/zod-schemas';
import { AccountRepository } from '@/repositories';
import { Money } from '@/components/custom/Money';
import type { Account, Goal, AccountType } from '@/types';

const accountRepo = new AccountRepository();

const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  TFSA:          'TFSA',
  RRSP:          'RRSP',
  FHSA:          'FHSA',
  NonRegistered: 'Non-Registered',
  USD_NonReg:    'USD Non-Reg',
  CryptoWallet:  'Crypto Wallet',
};

const ACCOUNT_TYPE_DESCRIPTIONS: Record<AccountType, string> = {
  TFSA:          'Tax-free growth and withdrawal',
  RRSP:          'Tax-deductible, deferred tax on withdrawal',
  FHSA:          'First Home Savings Account — $40K lifetime cap',
  NonRegistered: 'Taxable — full ACB tracking, eligible/non-eligible dividends',
  USD_NonReg:    'US dollar taxable — dual-currency display, FX risk',
  CryptoWallet:  'Cryptocurrency — every trade is a taxable event',
};

const CURRENCY_DEFAULTS: Record<AccountType, string> = {
  TFSA: 'CAD', RRSP: 'CAD', FHSA: 'CAD',
  NonRegistered: 'CAD', USD_NonReg: 'USD', CryptoWallet: 'USD',
};

export function AccountsPage() {
  const { currentUser } = useUserStore();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

  const accounts = useLiveQuery<Account[]>(
    () => currentUser
      ? db.accounts.where('userId').equals(currentUser.id).filter((a) => !a.deletedAt).toArray()
      : Promise.resolve([] as Account[]),
    [currentUser?.id]
  );

  const goals = useLiveQuery<Goal[]>(
    () => currentUser
      ? db.goals.where('userId').equals(currentUser.id).filter((g) => !g.deletedAt).toArray()
      : Promise.resolve([] as Goal[]),
    [currentUser?.id]
  );

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormData>({
    resolver: zodResolver(AccountSchema),
    defaultValues: { currency: 'CAD' },
  });

  const selectedType = watch('type');

  // Auto-set currency when account type changes
  const handleTypeChange = (type: AccountType) => {
    setValue('type', type);
    setValue('currency', CURRENCY_DEFAULTS[type] ?? 'CAD');
  };

  const openCreate = () => {
    setEditingAccount(null);
    reset({ currency: 'CAD' });
    setShowForm(true);
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    reset({
      name:                  account.name,
      type:                  account.type,
      goalId:                account.goalId,
      currency:              account.currency,
      institution:           account.institution ?? undefined,
      contributionRoomCents: account.contributionRoomCents ?? undefined,
      contributionRoomYear:  account.contributionRoomYear ?? undefined,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: AccountFormData) => {
    if (!currentUser) return;
    const now = new Date().toISOString();

    if (editingAccount) {
      await accountRepo.update(editingAccount.id, { ...data, updatedAt: now });
    } else {
      const account: Account = {
        id: uuidv4(),
        userId: currentUser.id,
        goalId: data.goalId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        institution: data.institution,
        contributionRoomCents: data.contributionRoomCents,
        contributionRoomYear: data.contributionRoomYear,
        createdAt: now,
        updatedAt: now,
      };
      await accountRepo.create(account);
    }

    setShowForm(false);
    setEditingAccount(null);
  };

  const handleDelete = async (account: Account) => {
    if (confirm(`Delete account "${account.name}"? Existing transactions will be preserved but unlinked.`)) {
      await accountRepo.softDelete(account.id);
    }
  };

  const goalMap = new Map((goals ?? []).map((g) => [g.id, g]));

  if (!currentUser) {
    return <div className="text-center py-16 text-subtext">Please set up your profile first.</div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-maintext">Accounts</h1>
          <p className="text-sm text-subtext mt-0.5">
            Each account belongs to one goal (Plan A binding)
          </p>
        </div>
        <button
          onClick={openCreate}
          className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + New Account
        </button>
      </div>

      {/* Account form */}
      {showForm && (
        <div className="bg-white rounded-card shadow-card border border-border p-6">
          <h2 className="text-base font-semibold text-maintext mb-4">
            {editingAccount ? 'Edit Account' : 'New Account'}
          </h2>

          {(!goals || goals.length === 0) && (
            <div className="bg-warning/10 border border-warning/30 rounded-input p-3 mb-4 text-sm text-maintext">
              You need to create at least one Goal before adding an account.{' '}
              <a href="/goals" className="text-brand underline">Create a Goal →</a>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Name + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Account name</label>
                <input
                  {...register('name')}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Wealthsimple TFSA"
                />
                {errors.name && <p className="text-xs text-loss mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Account type</label>
                <select
                  {...register('type')}
                  onChange={(e) => handleTypeChange(e.target.value as AccountType)}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">— Select type —</option>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                {errors.type && <p className="text-xs text-loss mt-1">{errors.type.message}</p>}
                {selectedType && (
                  <p className="text-xs text-subtext mt-1">{ACCOUNT_TYPE_DESCRIPTIONS[selectedType]}</p>
                )}
              </div>
            </div>

            {/* Goal binding + Institution */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">
                  Linked goal <span className="text-subtext font-normal">(Plan A)</span>
                </label>
                <select
                  {...register('goalId')}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="">— Select goal —</option>
                  {(goals ?? []).map((g) => (
                    <option key={g.id} value={g.id}>{g.name} ({g.goalType})</option>
                  ))}
                </select>
                {errors.goalId && <p className="text-xs text-loss mt-1">{errors.goalId.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Institution (optional)</label>
                <input
                  {...register('institution')}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Wealthsimple, Questrade"
                />
              </div>
            </div>

            {/* Currency + Contribution room */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Currency</label>
                <select
                  {...register('currency')}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Contribution room (cents)</label>
                <input
                  {...register('contributionRoomCents', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. 700000 = $7,000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Room year</label>
                <input
                  {...register('contributionRoomYear', { valueAsNumber: true })}
                  type="number"
                  min={2000}
                  max={2100}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="2026"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || (!goals || goals.length === 0)}
                className="bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Saving…' : editingAccount ? 'Save Changes' : 'Create Account'}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setEditingAccount(null); }}
                className="border border-border text-maintext px-5 py-2 rounded-button text-sm font-medium hover:bg-divider transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account list */}
      {(!accounts || accounts.length === 0) && !showForm && (
        <div className="bg-white rounded-card shadow-card p-8 text-center">
          <p className="text-3xl mb-3">🏦</p>
          <h3 className="text-base font-semibold text-maintext mb-1">No accounts yet</h3>
          <p className="text-sm text-subtext mb-4">
            Add your TFSA, RRSP, or other investment accounts to start tracking.
          </p>
          <button
            onClick={openCreate}
            className="bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Add Your First Account
          </button>
        </div>
      )}

      {/* Grouped by type */}
      {accounts && accounts.length > 0 && (
        <div className="space-y-3">
          {accounts.map((account) => {
            const goal = goalMap.get(account.goalId);
            return (
              <div key={account.id} className="bg-white rounded-card shadow-card p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        account.type === 'CryptoWallet'
                          ? 'bg-crypto/10 text-crypto'
                          : account.type === 'USD_NonReg'
                            ? 'bg-info/10 text-info'
                            : 'bg-brand/10 text-brand'
                      }`}>
                        {ACCOUNT_TYPE_LABELS[account.type]}
                      </span>
                      <h3 className="font-medium text-maintext">{account.name}</h3>
                    </div>
                    <div className="text-sm text-subtext space-x-3">
                      {goal && <span>Goal: {goal.name}</span>}
                      {account.institution && <span>@ {account.institution}</span>}
                      <span>{account.currency}</span>
                      {account.contributionRoomCents != null && account.contributionRoomCents > 0 && (
                        <span>
                          Room: <Money cents={account.contributionRoomCents} currency={account.currency} className="text-sm" />
                          {account.contributionRoomYear && ` (${account.contributionRoomYear})`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-4">
                    <button onClick={() => openEdit(account)} className="text-xs text-brand hover:underline">Edit</button>
                    <button onClick={() => handleDelete(account)} className="text-xs text-loss hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
