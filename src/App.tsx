import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/pages/Dashboard/DashboardPage';
import { HoldingsPage } from '@/pages/Holdings/HoldingsPage';
import { GoalsPage } from '@/pages/Goals/GoalsPage';
import { ProfileSetupPage } from '@/pages/Profile/ProfileSetupPage';
import { AccountsPage } from '@/pages/Accounts/AccountsPage';
import { SettingsPage } from '@/pages/Settings/SettingsPage';
import { WatchListPage } from '@/pages/WatchList/WatchListPage';
import { useUserStore } from '@/stores/userStore';
import { useHoldingsStore } from '@/stores/holdingsStore';
import { useQuoteRefresh } from '@/hooks/useQuoteRefresh';
import { ErrorBoundary } from '@/components/custom/ErrorBoundary';
import { UserRepository, AccountRepository, HoldingRepository } from '@/repositories';

const userRepo = new UserRepository();
const accountRepo = new AccountRepository();
const holdingRepo = new HoldingRepository();

// Stub pages for routes not yet built in Phase 1
function StubPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <p className="text-4xl mb-3">🚧</p>
      <h2 className="text-xl font-semibold text-maintext mb-1">{title}</h2>
      <p className="text-sm text-subtext">Coming in Phase 2 or 3.</p>
    </div>
  );
}

export default function App() {
  const { currentUser, setUser, setLoading } = useUserStore();
  const { setHoldings } = useHoldingsStore();

  // Quote polling — enabled only when a user is logged in and holdings exist
  useQuoteRefresh(!!currentUser);

  // On mount: load user → accounts → holdings from IndexedDB
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const users = await userRepo.getAll();
        const user = users[0] ?? null;
        setUser(user);

        if (user) {
          // Load all accounts for the user, then fetch holdings across those accounts
          const accounts = await accountRepo.getAll(user.id);
          const accountIds = accounts.map((a) => a.id);
          if (accountIds.length > 0) {
            const allHoldings = await holdingRepo.getAllForUser(accountIds);
            setHoldings(allHoldings);
          }
        }
      } catch (err) {
        console.error('App init error:', err);
      } finally {
        setLoading(false);
      }
    }
    void init();
  }, [setUser, setLoading, setHoldings]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/"          element={<DashboardPage />} />
            <Route path="/holdings"  element={<HoldingsPage />} />
            <Route path="/goals"     element={<GoalsPage />} />
            <Route path="/accounts"  element={<AccountsPage />} />
            <Route path="/watchlist" element={<WatchListPage />} />
            <Route path="/insights"  element={<StubPage title="Insights" />} />
            <Route path="/news"      element={<StubPage title="News & Events" />} />
            <Route path="/advisor"   element={<StubPage title="AI Advisor" />} />
            <Route path="/settings"  element={<SettingsPage />} />
            <Route path="/profile"   element={<ProfileSetupPage />} />
            <Route path="*"          element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
