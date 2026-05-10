// ============================================================
// GoalsPage — Goal list + create/edit goals
// Per doc 04 §6.3
// ============================================================

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';
import { db } from '@/db';
import { useUserStore } from '@/stores/userStore';
import { GoalSchema, type GoalFormData } from '@/lib/zod-schemas';
import { GoalRepository } from '@/repositories';
import { Money } from '@/components/custom/Money';
import { formatDate } from '@/lib/formatters';
import type { Goal } from '@/types';

const repo = new GoalRepository();

const GOAL_TYPE_LABELS: Record<Goal['goalType'], string> = {
  house_down_payment: '🏠 House Down Payment',
  retirement: '🌴 Retirement',
  education: '🎓 Education',
  major_purchase: '🛒 Major Purchase',
  wealth_growth: '📈 Wealth Growth',
  other: '🎯 Other',
};

export function GoalsPage() {
  const { currentUser } = useUserStore();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

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
    formState: { errors, isSubmitting },
  } = useForm<GoalFormData>({
    resolver: zodResolver(GoalSchema),
    defaultValues: { priority: 2, isFlexible: false },
  });

  const openCreate = () => {
    setEditingGoal(null);
    reset({ priority: 2, isFlexible: false });
    setShowForm(true);
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    reset({
      name: goal.name,
      goalType: goal.goalType,
      targetAmountCents: goal.targetAmountCents,
      targetDate: goal.targetDate,
      priority: goal.priority,
      riskAllocation: goal.riskAllocation,
      isFlexible: goal.isFlexible,
    });
    setShowForm(true);
  };

  const onSubmit = async (data: GoalFormData) => {
    if (!currentUser) return;
    const now = new Date().toISOString();

    if (editingGoal) {
      await repo.update(editingGoal.id, {
        ...data,
        updatedAt: now,
      });
    } else {
      const goal: Goal = {
        id: uuidv4(),
        userId: currentUser.id,
        name: data.name,
        goalType: data.goalType,
        targetAmountCents: data.targetAmountCents,
        targetDate: data.targetDate,
        priority: data.priority,
        riskAllocation: data.riskAllocation,
        monthlyContributionCents: data.monthlyContributionCents,
        expectedAnnualReturn: data.expectedAnnualReturn,
        isFlexible: data.isFlexible,
        createdAt: now,
        updatedAt: now,
      };
      await repo.create(goal);
    }

    setShowForm(false);
    setEditingGoal(null);
  };

  const handleDelete = async (goal: Goal) => {
    if (confirm(`Delete goal "${goal.name}"? This will not delete associated accounts.`)) {
      await repo.softDelete(goal.id);
    }
  };

  if (!currentUser) {
    return (
      <div className="text-center py-16">
        <p className="text-subtext">Please set up your profile first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-maintext">Goals</h1>
        <button
          onClick={openCreate}
          className="bg-brand text-white px-4 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
        >
          + New Goal
        </button>
      </div>

      {/* Goal form modal (inline for simplicity in Phase 1) */}
      {showForm && (
        <div className="bg-white rounded-card shadow-card border border-border p-6">
          <h2 className="text-base font-semibold text-maintext mb-4">
            {editingGoal ? 'Edit Goal' : 'New Goal'}
          </h2>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-maintext mb-1">Goal name</label>
              <input
                {...register('name')}
                className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                placeholder="e.g. Down payment for condo"
              />
              {errors.name && <p className="text-xs text-loss mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Goal type</label>
                <select {...register('goalType')} className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  {Object.entries(GOAL_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Priority</label>
                <select {...register('priority', { valueAsNumber: true })} className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                  <option value={1}>1 — Highest</option>
                  <option value={2}>2 — Medium</option>
                  <option value={3}>3 — Lower</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Target amount (CAD)</label>
                <input
                  {...register('targetAmountCents', { valueAsNumber: true })}
                  type="number"
                  min={0}
                  step={100}
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="100000"
                />
                <p className="text-xs text-subtext mt-0.5">Enter in cents (e.g. $100,000 = 10000000)</p>
                {errors.targetAmountCents && <p className="text-xs text-loss mt-1">{errors.targetAmountCents.message}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-maintext mb-1">Target date</label>
                <input
                  {...register('targetDate')}
                  type="date"
                  className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                />
                {errors.targetDate && <p className="text-xs text-loss mt-1">{errors.targetDate.message}</p>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-maintext mb-1">Risk allocation</label>
              <select {...register('riskAllocation')} className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand">
                <option value="conservative">Conservative</option>
                <option value="balanced">Balanced</option>
                <option value="aggressive">Aggressive</option>
              </select>
            </div>

            <div className="flex items-center gap-3">
              <input type="checkbox" id="isFlexible" {...register('isFlexible')} className="w-4 h-4 accent-brand" />
              <label htmlFor="isFlexible" className="text-sm text-maintext">Target date is flexible</label>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60"
              >
                {isSubmitting ? 'Saving…' : editingGoal ? 'Save Changes' : 'Create Goal'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="border border-border text-maintext px-5 py-2 rounded-button text-sm font-medium hover:bg-divider transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goal list */}
      {goals?.length === 0 && !showForm && (
        <div className="bg-white rounded-card shadow-card p-8 text-center">
          <p className="text-3xl mb-3">🎯</p>
          <h3 className="text-base font-semibold text-maintext mb-1">No goals yet</h3>
          <p className="text-sm text-subtext mb-4">Create a goal to start organizing your portfolio.</p>
          <button
            onClick={openCreate}
            className="bg-brand text-white px-5 py-2 rounded-button text-sm font-medium hover:bg-brand-dark transition-colors"
          >
            Create Your First Goal
          </button>
        </div>
      )}

      <div className="space-y-3">
        {goals?.map((goal) => (
          <div key={goal.id} className="bg-white rounded-card shadow-card p-5 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{GOAL_TYPE_LABELS[goal.goalType]?.split(' ')[0]}</span>
                <h3 className="font-medium text-maintext">{goal.name}</h3>
                <span className="text-xs bg-divider text-subtext px-2 py-0.5 rounded-full">P{goal.priority}</span>
              </div>
              <div className="text-sm text-subtext space-x-3">
                <span>Target: <Money cents={goal.targetAmountCents} className="text-sm" /></span>
                <span>By: {formatDate(goal.targetDate)}</span>
                <span className="capitalize">{goal.riskAllocation}</span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0 ml-4">
              <button
                onClick={() => openEdit(goal)}
                className="text-xs text-brand hover:underline"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(goal)}
                className="text-xs text-loss hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
