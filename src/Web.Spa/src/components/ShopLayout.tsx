import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useCart } from '../cart/CartContext';
import { useI18n } from '../i18n/I18nContext';
import { AppLayout } from './AppLayout';
import { Icon } from './Icon';
import { LanguageSwitcher } from './LanguageSwitcher';

/**
 * Vỏ công khai cho cửa hàng: khách chưa đăng nhập vẫn xem được sản phẩm.
 * Đã đăng nhập thì dùng luôn layout back office để không mất sidebar.
 */
export function ShopLayout() {
  const { user } = useAuth();
  const { t } = useI18n();
  const cart = useCart();

  if (user) {
    return <AppLayout />;
  }

  return (
    <div className="shop-public">
      <header className="shop-topbar">
        <Link to="/shop" className="shop-brand">
          <span className="app-brand-mark">SF</span>
          <strong>StockFlow</strong>
        </Link>
        <div className="shop-topbar-actions">
          <LanguageSwitcher />
          <Link to="/cart" className="btn btn-sm btn-outline-secondary" data-testid="public-cart">
            <Icon name="invoice" className="me-1" />
            {t('nav.cart')}
            {cart.count > 0 ? <span className="badge-count">{cart.count}</span> : null}
          </Link>
          <Link to="/login" className="btn btn-sm btn-primary" data-testid="public-signin">
            {t('login.signIn')}
          </Link>
        </div>
      </header>
      <main className="shop-public-content">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>StockFlow · ASP.NET Core 8 + React 18/TypeScript</span>
        <span className="text-muted">Order &amp; inventory demo</span>
      </footer>
    </div>
  );
}
