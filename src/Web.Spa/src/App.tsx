import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireAuth, RequireRole, RequireSales } from './auth/RequireAuth';
import { AppLayout } from './components/AppLayout';
import { ShopLayout } from './components/ShopLayout';
import { ToastProvider } from './components/Toast';
import { CartProvider } from './cart/CartContext';
import { I18nProvider } from './i18n/I18nContext';
import { AdminAccountsPage } from './pages/AdminAccountsPage';
import { AdminStatusPage } from './pages/AdminStatusPage';
import { CartPage } from './pages/CartPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { DashboardPage } from './pages/DashboardPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { InvoiceListPage } from './pages/InvoiceListPage';
import { InvoicePrintPage } from './pages/InvoicePrintPage';
import { LoginPage } from './pages/LoginPage';
import { MyOrdersPage } from './pages/MyOrdersPage';
import { OrderCreatePage } from './pages/OrderCreatePage';
import { OrderDetailPage } from './pages/OrderDetailPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductPage } from './pages/ProductPage';
import { ProductsPage } from './pages/ProductsPage';
import { RegisterPage } from './pages/RegisterPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { ShopPage } from './pages/ShopPage';
import { StaffProductsPage } from './pages/StaffProductsPage';

/**
 * Shell của phần đã đăng nhập. `key` đổi theo tài khoản ⇒ mọi trang bên trong
 * được mount lại hoàn toàn khi đổi user, nên không thể hiển thị dữ liệu/state
 * của tài khoản trước đó.
 */
function ProtectedShell() {
  const { user } = useAuth();
  const identity = user ? `${user.name}:${user.role}` : 'anonymous';

  return (
    <RequireAuth>
      <AppLayout key={identity} />
    </RequireAuth>
  );
}

export function App() {
  return (
    <I18nProvider>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <CartProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />

                {/* Cửa hàng công khai: xem sản phẩm không cần đăng nhập */}
                <Route element={<ShopLayout />}>
                  <Route path="/shop" element={<ShopPage />} />
                  <Route path="/shop/:id" element={<ProductPage />} />
                </Route>

                <Route element={<ProtectedShell />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route
                    path="/checkout"
                    element={
                      <RequireRole roles={['Customer']}>
                        <CheckoutPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/my-orders"
                    element={
                      <RequireRole roles={['Customer']}>
                        <MyOrdersPage />
                      </RequireRole>
                    }
                  />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route
                    path="/orders/new"
                    element={
                      <RequireSales>
                        <OrderCreatePage />
                      </RequireSales>
                    }
                  />
                  <Route
                    path="/staff/products"
                    element={
                      <RequireRole roles={['Admin', 'Sales']}>
                        <StaffProductsPage />
                      </RequireRole>
                    }
                  />
                  <Route path="/products" element={<ProductsPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/invoices" element={<InvoiceListPage />} />
                  <Route path="/invoices/:id" element={<InvoicePrintPage />} />
                  <Route
                    path="/admin/accounts"
                    element={
                      <RequireRole roles={['Admin']}>
                        <AdminAccountsPage />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/status"
                    element={
                      <RequireRole roles={['Admin']}>
                        <AdminStatusPage />
                      </RequireRole>
                    }
                  />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </CartProvider>
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nProvider>
  );
}
