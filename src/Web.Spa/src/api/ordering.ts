import { get, patch, post } from './client';
import type {
  Account,
  CheckoutLineInput,
  CompanyProfile,
  CreateAccountInput,
  CreateOrderInput,
  Customer,
  Invoice,
  InvoiceDetail,
  LoginResponse,
  Order,
  OrderStatus,
  PagedResult,
  PayInput,
  RegisterInput,
  ShipResult,
  ShopStats,
  UpdateAccountInput,
} from './types';

export function login(username: string, password: string): Promise<LoginResponse> {
  return post<LoginResponse>('ordering', '/api/auth/login', { username, password });
}

export function register(input: RegisterInput): Promise<LoginResponse> {
  return post<LoginResponse>('ordering', '/api/auth/register', input);
}

export function getCustomers(): Promise<Customer[]> {
  return get<Customer[]>('ordering', '/api/customers');
}

export function getOrders(status?: OrderStatus | '', pageSize = 100): Promise<PagedResult<Order>> {
  const query = new URLSearchParams({ page: '1', pageSize: String(pageSize) });
  if (status) {
    query.set('status', status);
  }
  return get<PagedResult<Order>>('ordering', `/api/orders?${query.toString()}`);
}

export function getOrder(id: number): Promise<Order> {
  return get<Order>('ordering', `/api/orders/${id}`);
}

export function createOrder(input: CreateOrderInput): Promise<Order> {
  return post<Order>('ordering', '/api/orders', input);
}

export function confirmOrder(id: number): Promise<Order> {
  return post<Order>('ordering', `/api/orders/${id}/confirm`, {});
}

export function cancelOrder(id: number): Promise<Order> {
  return post<Order>('ordering', `/api/orders/${id}/cancel`, {});
}

export function shipOrder(id: number): Promise<ShipResult> {
  return post<ShipResult>('ordering', `/api/orders/${id}/ship`, {});
}

export function getInvoices(): Promise<Invoice[]> {
  return get<Invoice[]>('ordering', '/api/invoices');
}

export function getInvoiceDetail(id: number): Promise<InvoiceDetail> {
  return get<InvoiceDetail>('ordering', `/api/invoices/${id}`);
}

export function getCompanyProfile(): Promise<CompanyProfile> {
  return get<CompanyProfile>('ordering', '/api/company');
}

// ---------- Storefront (khách mua hàng) ----------

export function shopCheckout(
  lines: CheckoutLineInput[],
  note: string | null,
  paymentMethod: 'online' | 'cash',
): Promise<Order> {
  return post<Order>('ordering', '/api/shop/checkout', { lines, note, paymentMethod });
}

/** Thu tiền mặt cho đơn COD (Admin/Sales). */
export function collectCash(orderId: number): Promise<Order> {
  return post<Order>('ordering', `/api/shop/orders/${orderId}/collect-cash`, {});
}

export function shopPay(orderId: number, payment: PayInput): Promise<Order> {
  return post<Order>('ordering', `/api/shop/orders/${orderId}/pay`, payment);
}

export function getMyOrders(): Promise<Order[]> {
  return get<Order[]>('ordering', '/api/shop/orders');
}

// ---------- Back office: tài khoản & số liệu ----------

export function getAccounts(): Promise<Account[]> {
  return get<Account[]>('ordering', '/api/accounts');
}

export function createAccount(input: CreateAccountInput): Promise<Account> {
  return post<Account>('ordering', '/api/accounts', input);
}

export function updateAccount(id: number, input: UpdateAccountInput): Promise<Account> {
  return patch<Account>('ordering', `/api/accounts/${id}`, input);
}

export function getShopStats(): Promise<ShopStats> {
  return get<ShopStats>('ordering', '/api/accounts/stats');
}

// ---------- Quên / đặt lại mật khẩu ----------

export interface ForgotPasswordResult {
  resetToken?: string | null;
  expiresAt?: string | null;
  message: string;
}

export function forgotPassword(identifier: string): Promise<ForgotPasswordResult> {
  return post<ForgotPasswordResult>('ordering', '/api/auth/forgot-password', {
    usernameOrEmail: identifier,
  });
}

export function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  return post<{ message: string }>('ordering', '/api/auth/reset-password', { token, newPassword });
}