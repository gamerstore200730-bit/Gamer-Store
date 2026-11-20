import { useEffect, useState } from 'react';
import Starfield from './components/Starfield';
import TopBar from './components/TopBar';
import Home from './pages/Home';
import TopUpPage from './pages/TopUpPage';
import AccountsPage from './pages/AccountsPage';
import AdminLogin from './pages/AdminLogin';
import AdminOrders from './pages/AdminOrders';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './lib/useAuth';
import type { Page } from './data/store';

type AdminSection = 'orders' | 'packages' | 'accounts' | 'requests';

function pageFromHash(): Page {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const pages: Page[] = [
    'topup-ml',
    'topup-starlight',
    'accounts-customers',
    'accounts-store',
    'admin',
  ];
  return (pages as string[]).includes(hash) ? (hash as Page) : 'home';
}

export default function App() {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [adminSection, setAdminSection] = useState<AdminSection>('orders');
  const { session, isAdmin, loading } = useAuth();

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (p: Page) => {
    window.location.hash = p === 'home' ? '/' : `/${p}`;
    setPage(p);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-ink">
      {page === 'home' && (
        <div className="starfield">
          <Home go={go} />
        </div>
      )}

      {page !== 'home' && (
        <div className="starfield relative flex min-h-screen flex-col">
          <TopBar onBack={() => go('home')} title="Gamer Store" go={go} />
          <main className="relative z-10 flex-1">
            {(page === 'topup-ml' || page === 'topup-starlight') && (
              <>
                <TopUpPage key={page} variant={page === 'topup-ml' ? 'ml' : 'starlight'} />
              </>
            )}
            {page === 'accounts-customers' && <AccountsPage variant="customers" />}
            {page === 'accounts-store' && <AccountsPage variant="store" />}
            {page === 'admin' &&
              (loading ? (
                <p className="py-10 text-center text-sm text-muted">جارٍ التحميل...</p>
              ) : session && isAdmin ? (
                <AdminDashboard section={adminSection} onNavigate={setAdminSection} />
              ) : (
                <AdminLogin />
              ))}
          </main>
        </div>
      )}
    </div>
  );
}
