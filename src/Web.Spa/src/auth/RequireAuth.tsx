import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../api/client';
import { useAuth } from './AuthContext';

/**
 * Chặn route khi chưa đăng nhập.
 * Subscribe auth context để khi logout (state → null) là redirect ngay, không cần reload.
 * Đồng thời kiểm tra token thật trong sessionStorage (trường hợp token bị xoá/hết hạn bên ngoài).
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user || !getToken()) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <>{children}</>;
}

/** Chỉ cho role có quyền bán (Sales/Admin) vào; viewer bị đẩy về danh sách đơn. */
export function RequireSales({ children }: { children: ReactNode }) {
  const { canSell } = useAuth();

  if (!canSell) {
    return <Navigate to="/orders" replace />;
  }

  return <>{children}</>;
}

/** Giới hạn theo danh sách role; sai role thì đưa về trang phù hợp với chính role đó. */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const { user } = useAuth();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to={user?.role === 'Customer' ? '/shop' : '/'} replace />;
  }

  return <>{children}</>;
}
