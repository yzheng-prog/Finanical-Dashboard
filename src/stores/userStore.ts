import { create } from 'zustand';
import type { User } from '@/types';

interface UserState {
  currentUser: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  isLoading: true,
  setUser: (user) => set({ currentUser: user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
}));
