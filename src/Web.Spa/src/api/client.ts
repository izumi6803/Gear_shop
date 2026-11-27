// HTTP client dùng chung: 2 base URL (ordering/catalog), Bearer token, lỗi thống nhất ApiError.

export type ApiName = 'ordering' | 'catalog';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const BASE: Record<ApiName, string> = {
  ordering: import.meta.env.VITE_ORDERING_BASE ?? '/ordering-api',
  catalog: import.meta.env.VITE_CATALOG_BASE ?? '/catalog-api',
};

const TOKEN_KEY = 'stockflow.token';
export const UNAUTHORIZED_EVENT = 'stockflow:unauthorized';

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

interface ErrorPayload {
  message?: string;
  detail?: string;
  title?: string;
  code?: string;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function request<T>(
  api: ApiName,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const token = getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE[api]}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Không kết nối được API. Kiểm tra backend đã chạy chưa.', 0);
  }

  // 401 ở bất kỳ call nào (trừ chính endpoint login) → coi như mất phiên.
  if (response.status === 401 && !path.includes('/api/auth/login')) {
    setToken(null);
    window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new ApiError('Phiên đăng nhập đã hết hạn.', 401);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const payload = text ? parseJson(text) : null;

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ErrorPayload;
    const message =
      errorPayload.message ??
      errorPayload.detail ??
      errorPayload.title ??
      `API trả về ${response.status}`;
    throw new ApiError(message, response.status, errorPayload.code);
  }

  return payload as T;
}

export function get<T>(api: ApiName, path: string): Promise<T> {
  return request<T>(api, path, { method: 'GET' });
}

export function post<T>(api: ApiName, path: string, body?: unknown): Promise<T> {
  return request<T>(api, path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function put<T>(api: ApiName, path: string, body?: unknown): Promise<T> {
  return request<T>(api, path, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function patch<T>(api: ApiName, path: string, body?: unknown): Promise<T> {
  return request<T>(api, path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}