// ============================================================
// TransactionForm — Full transaction entry form (all 12 types)
// Per doc 01 §3.2 and doc 03 Transaction schema
// ============================================================

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import { TransactionSchema, type TransactionFormData } from '@/lib/zod-schemas';
import { TransactionRepository } from '@/repositories';
import { HoldingsService } from '@/services/HoldingsService';
import { SnapshotRepository } from '@/repositories/SnapshotRepository';
import { HoldingRepository } from '@/repositories/HoldingRepository';
import type { Account, Transaction } from '@/types';

const txnRepo = new TransactionRepository();
const holdingRepo = new HoldingRepository();
const snapshotRepo = new SnapshotRepository();
const holdingsService = new HoldingsService(txnRepo, holdingRepo, snapshotRepo);

interface TransactionFormProps {
  accounts: Account[];
  prefillSymbol?: string;
  onSuccess: () => void;
}

// Transaction types that require quantity > 0
const QTY_TYPES = new Set(['buy','sell','drip','split','transfer_in','transfer_out']);
// Types that don't have a price
const NO_PRICE_TYPES = new Set(['split','fee','interest','conversion']);
// Types that need conversion fields
const CONVERSION_TYPES = new Set(['conversion']);
// Types that need split ratio
const SPLIT_TYPES = new Set(['split']);

const TYPE_LABELS: Record<Transaction['type'], string> = {
  buy:                    'Buy',
  sell:                   'Sell',
  eligible_dividend:      'Eligible Dividend',
  non_eligible_dividend:  'Non-Eligible Dividend',
  dividend:               'Dividend (Generic)',
  return_of_capital:      'Return of Capital (ROC)',
  drip:                   'DRIP Reinvestment',
  split:                  'Stock Split',
  transfer_in:            'Transfer In',
  transfer_out:           'Transfer Out',
  fee:                    'Fee / Commission',
  interest:               'Interest',
  conversion:             'Currency Conversion',
};

export function TransactionForm({ accounts, prefillSymbol, onSuccess }: TransactionFormProps) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormData>({
    resolver: zodResolver(TransactionSchema),
    defaultValues: {
      executedAt: format(new Date(), 'yyyy-MM-dd'),
      currency: 'CAD',
      feeCents: 0,
      symbol: prefillSymbol ?? '',
    },
  });

  const txnType = watch('type');
  const selectedAccountId = watch('accountId');

  // Auto-set currency based on selected account
  useEffect(() => {
    if (!selectedAccountId) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (account) {
      setValue('currency', account.currency ?? 'CAD');
    }
  }, [selectedAccountId, accounts, setValue]);

  const showQty = QTY_TYPES.has(txnType);
  const showPrice = !NO_PRICE_TYPES.has(txnType);
  const showConversion = CONVERSION_TYPES.has(txnType);
  const showSplitRatio = SPLIT_TYPES.has(txnType);

  const onSubmit = async (data: TransactionFormData) => {
    const now = new Date().toISOString();
    const transaction: Transaction = {
      id: uuidv4(),
      accountId: data.accountId,
      symbol: data.symbol.toUpperCase(),
      type: data.type,
      quantity: data.quantity,
      pricePerUnitCents: data.pricePerUnitCents,
      totalAmountCents: data.totalAmountCents,
      feeCents: data.feeCents ?? 0,
      currency: data.currency,
      fxRate: data.fxRate,
      executedAt: `${data.executedAt}T12:00:00.000Z`,
      settlementDate: data.settlementDate ? `${data.settlementDate}T12:00:00.000Z` : undefined,
      splitRatio: data.splitRatio,
      conversionFromCurrency: data.conversionFromCurrency,
      conversionToCurrency: data.conversionToCurrency,
      conversionFromAmountCents: data.conversionFromAmountCents,
      conversionToAmountCents: data.conversionToAmountCents,
      notes: data.notes,
      createdAt: now,
      updatedAt: now,
    };

    await txnRepo.create(transaction);
    // Recompute holdings immediately
    await holdingsService.recomputeAfterTransactionChange(data.accountId, data.symbol.toUpperCase());
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        {/* Account */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">Account</label>
          <select
            {...register('accountId')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name} ({a.type})</option>
            ))}
          </select>
          {errors.accountId && <p className="text-xs text-loss mt-1">{errors.accountId.message}</p>}
        </div>

        {/* Transaction type */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">Type</label>
          <select
            {...register('type')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">— Select type —</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-loss mt-1">{errors.type.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Symbol */}
        {!showConversion && (
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">Symbol</label>
            <input
              {...register('symbol')}
              className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="e.g. VFV.TO"
            />
            {errors.symbol && <p className="text-xs text-loss mt-1">{errors.symbol.message}</p>}
          </div>
        )}

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">Trade date</label>
          <input
            {...register('executedAt')}
            type="date"
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {errors.executedAt && <p className="text-xs text-loss mt-1">{errors.executedAt.message}</p>}
        </div>
      </div>

      {/* Quantity + Price */}
      {(showQty || showPrice) && (
        <div className="grid grid-cols-3 gap-4">
          {showQty && (
            <div>
              <label className="block text-sm font-medium text-maintext mb-1">Quantity</label>
              <input
                {...register('quantity', { valueAsNumber: true })}
                type="number"
                step="0.0001"
                min={0}
                className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="100"
              />
              {errors.quantity && <p className="text-xs text-loss mt-1">{errors.quantity.message}</p>}
            </div>
          )}
          {showPrice && (
            <div>
              <label className="block text-sm font-medium text-maintext mb-1">Price/unit (cents)</label>
              <input
                {...register('pricePerUnitCents', { valueAsNumber: true })}
                type="number"
                min={0}
                className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="10000"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">Total amount (cents)</label>
            <input
              {...register('totalAmountCents', { valueAsNumber: true })}
              type="number"
              min={0}
              className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
              placeholder="1000000"
            />
            {errors.totalAmountCents && <p className="text-xs text-loss mt-1">{errors.totalAmountCents.message}</p>}
          </div>
        </div>
      )}

      {/* Fee + Currency */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">Fee (cents)</label>
          <input
            {...register('feeCents', { valueAsNumber: true })}
            type="number"
            min={0}
            className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="999"
          />
        </div>
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
          <label className="block text-sm font-medium text-maintext mb-1">FX rate (optional)</label>
          <input
            {...register('fxRate', { valueAsNumber: true })}
            type="number"
            step="0.0001"
            className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="1.3650"
          />
        </div>
      </div>

      {/* Split ratio */}
      {showSplitRatio && (
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">
            Split ratio <span className="text-subtext">(e.g. 2 for 2:1 split)</span>
          </label>
          <input
            {...register('splitRatio', { valueAsNumber: true })}
            type="number"
            step="0.5"
            min={0.1}
            className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="2"
          />
          {errors.splitRatio && <p className="text-xs text-loss mt-1">{errors.splitRatio.message}</p>}
        </div>
      )}

      {/* Conversion fields */}
      {showConversion && (
        <div className="grid grid-cols-2 gap-4 border border-border rounded-input p-4 bg-surface">
          <p className="col-span-2 text-xs text-subtext font-medium">Norbert's Gambit / FX conversion</p>
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">From currency</label>
            <input {...register('conversionFromCurrency')} className="w-full border border-border rounded-input px-3 py-2 text-sm" placeholder="CAD" />
          </div>
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">From amount (cents)</label>
            <input {...register('conversionFromAmountCents', { valueAsNumber: true })} type="number" className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">To currency</label>
            <input {...register('conversionToCurrency')} className="w-full border border-border rounded-input px-3 py-2 text-sm" placeholder="USD" />
          </div>
          <div>
            <label className="block text-sm font-medium text-maintext mb-1">To amount (cents)</label>
            <input {...register('conversionToAmountCents', { valueAsNumber: true })} type="number" className="w-full border border-border rounded-input px-3 py-2 text-sm font-mono" />
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-maintext mb-1">Notes (optional)</label>
        <textarea
          {...register('notes')}
          rows={2}
          className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none"
          placeholder="Optional notes about this transaction"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-brand text-white px-6 py-2.5 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Log Transaction'}
        </button>
      </div>
    </form>
  );
}
