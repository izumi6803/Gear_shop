import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useI18n } from '../i18n/I18nContext';
import { Icon, type IconName } from './Icon';
import { LanguageSwitcher } from './LanguageSwitcher';

interface NavItem {
  to: string;
  key: string;
  icon: IconName;
  end?: boolean;
  roles: string[];
}

const STAFF = ['Admin', 'Sales', 'Viewer'];

/** Menu đổi theo role: khách mua hàng chỉ thấy cửa hàng/giỏ/đơn của mình. */
const NAV: NavItem[] = [
  { to: '/', key: 'nav.dashboard', icon: 'dashboard', end: true, roles: STAFF },
  { to: '/shop', key: 'nav.shop', icon: 'inventory', roles: ['Customer', ...STAFF] },
  { to: '/cart', key: 'nav.cart', icon: 'invoice', roles: ['Customer', ...STAFF] },
  { to: '/my-orders', key: 'nav.myOrders', icon: 'list', roles: ['Customer'] },
  { to: '/orders', key: 'nav.orders', icon: 'orders', roles: STAFF },
  { to: '/orders/new', key: 'nav.newOrder', icon: 'new', roles: ['Admin', 'Sales'] },
  { to: '/staff/products', key: 'nav.staffProducts', icon: 'new', roles: ['Admin', 'Sales'] },
  { to: '/products', key: 'nav.products', icon: 'inventory', roles: STAFF },
  { to: '/invoices', key: 'nav.invoices', icon: 'invoice', roles: STAFF },
  { to: '/admin/accounts', key: 'nav.accounts', icon: 'inbox', roles: ['Admin'] },
  { to: '/admin/status', key: 'nav.status', icon: 'dashboard', roles: ['Admin'] },
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const items = NAV.filter((item) => item.roles.includes(user?.role ?? ''));

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-brand">
          <span className="app-brand-mark">SF</span>
          <span className="app-brand-text">
            <strong>StockFlow</strong>
            <small>{t('app.tagline')}</small>
          </span>
        </div>

        <nav className="app-nav" aria-label={t('nav.main')}>
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              data-testid={`nav-${item.key.replace('nav.', '')}`}
              className={({ isActive }) => `app-nav-link${isActive ? ' active' : ''}`}
            >
              <Icon name={item.icon} />
              <span className="app-nav-label">{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-foot">
          <LanguageSwitcher />
          <div className="app-user">
            <span className="app-avatar" aria-hidden="true">
              {user?.name?.charAt(0) ?? '?'}
            </span>
            <span className="app-user-meta">
              <strong>{user?.name ?? '—'}</strong>
              <small>{user?.role}</small>
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-light w-100"
            onClick={logout}
            data-testid="logout"
          >
            <Icon name="logout" className="me-1" />
            {t('nav.logout')}
          </button>
        </div>
      </aside>

      <div className="app-main">
        <main className="app-content">
          <Outlet />
        </main>
        <footer className="app-footer">
          <span>StockFlow · ASP.NET Core 8 + React 18/TypeScript</span>
          <span className="text-muted">Order &amp; inventory demo</span>
        </footer>
      </div>
    </div>
  );
}
