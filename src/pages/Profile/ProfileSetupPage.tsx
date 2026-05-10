// ============================================================
// ProfileSetupPage — First-run user profile wizard
// Creates/edits User entity. Used as both first-run and edit flows.
// ============================================================

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { UserProfileSchema, type UserProfileFormData } from '@/lib/zod-schemas';
import { UserRepository } from '@/repositories';
import { useUserStore } from '@/stores/userStore';
import type { User } from '@/types';

const repo = new UserRepository();

export function ProfileSetupPage() {
  const navigate = useNavigate();
  const { currentUser, setUser } = useUserStore();
  const isEdit = !!currentUser;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UserProfileFormData>({
    resolver: zodResolver(UserProfileSchema),
    defaultValues: currentUser
      ? {
          name:         currentUser.name,
          region:       currentUser.region,
          baseCurrency: currentUser.baseCurrency,
          riskProfile:  currentUser.riskProfile,
          assetTier:    currentUser.assetTier,
          province:     currentUser.province,
          hasSpouse:    currentUser.hasSpouse,
        }
      : { region: 'CA', baseCurrency: 'CAD' },
  });

  const onSubmit = async (data: UserProfileFormData) => {
    const now = new Date().toISOString();
    const user: User = {
      id:           currentUser?.id ?? uuidv4(),
      name:         data.name,
      region:       data.region,
      baseCurrency: data.baseCurrency,
      riskProfile:  data.riskProfile,
      assetTier:    data.assetTier,
      age:          data.age,
      annualIncomeCents:  data.annualIncomeCents,
      marginalTaxRate:    data.marginalTaxRate,
      province:     data.province,
      hasSpouse:    data.hasSpouse,
      emergencyFundCents: data.emergencyFundCents,
      createdAt:    currentUser?.createdAt ?? now,
      updatedAt:    now,
    };

    if (isEdit) {
      await repo.update(user.id, user);
    } else {
      await repo.create(user);
    }

    setUser(user);
    navigate('/');
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold text-maintext mb-1">
        {isEdit ? 'Edit Profile' : 'Welcome — Set up your profile'}
      </h1>
      <p className="text-sm text-subtext mb-8">
        {isEdit
          ? 'Update your investment profile.'
          : 'This takes about 2 minutes. Your data stays on this device.'}
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">
            Your name
          </label>
          <input
            {...register('name')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            placeholder="Jane Doe"
          />
          {errors.name && <p className="text-xs text-loss mt-1">{errors.name.message}</p>}
        </div>

        {/* Risk Profile */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">
            Risk profile
          </label>
          <select
            {...register('riskProfile')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="conservative">Conservative (30% stocks, 60% bonds)</option>
            <option value="moderate">Moderate (60% stocks, 35% bonds)</option>
            <option value="aggressive">Aggressive (85% stocks, 10% bonds)</option>
          </select>
          {errors.riskProfile && <p className="text-xs text-loss mt-1">{errors.riskProfile.message}</p>}
        </div>

        {/* Asset Tier */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">
            Portfolio size
          </label>
          <select
            {...register('assetTier')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="starter">Starter — under $50K</option>
            <option value="accumulator">Accumulator — $50K to $250K</option>
            <option value="growth">Growth — $250K to $1M</option>
            <option value="wealth">Wealth — over $1M</option>
          </select>
        </div>

        {/* Province */}
        <div>
          <label className="block text-sm font-medium text-maintext mb-1">
            Province <span className="text-subtext font-normal">(for tax calculations)</span>
          </label>
          <select
            {...register('province')}
            className="w-full border border-border rounded-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="">— Select province —</option>
            {['AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT'].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Spouse */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="hasSpouse"
            {...register('hasSpouse')}
            className="w-4 h-4 accent-brand"
          />
          <label htmlFor="hasSpouse" className="text-sm text-maintext">
            I have a spouse or common-law partner
            <span className="text-subtext text-xs block">Affects Superficial Loss Rule calculations</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-brand text-white py-2.5 rounded-button font-medium text-sm hover:bg-brand-dark transition-colors disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Profile →'}
        </button>
      </form>
    </div>
  );
}
