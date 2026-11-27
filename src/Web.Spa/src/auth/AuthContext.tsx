import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { UNAUTHORIZED_EVENT, getToken, setToken } from '../api/client';
import { login as loginRequest } from '../api/ordering';
import { broadcastAuth, subscribeAuth } from './authChannel';
import { decodeToken, isExpired, type TokenIdentity } from './jwt';

interface AuthUser {
  name: string;
  role: string;
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  role: string;
  isAdmin: boolean;
  canSell: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  logout: () => void;
}

const USER_KEY = 'stockflow.user';

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(identity: TokenIdentity): AuthUser {
  return { name: identity.name, role: identity.role, username: identity.username };
}

/** Xoá toàn bộ state của app (không chỉ token/user). */
function clearSession(): void {
  for (const key of Object.keys(sessionStorage)) {
    if (key.startsWith('stockflow.')) {
      sessionStorage.removeItem(key);
    }
  }
  setToken(null);
}

/**
 * Danh tính lấy từ JWT, không từ object user đã lưu: nếu storage bị lệch
 * (ví dụ tab cũ còn user admin nhưng token đã là của sales) thì token thắng,
 * hoặc phiên bị huỷ nếu token hỏng/hết hạn.
 */
function identityFromStorage(): AuthUser | null {
  const token = getToken();
  if (!token) {
    return null;
  }

  const identity = decodeToken(token);
  if (isExpired(identity)) {
    clearSession();
    return null;
  }

  const user = toUser(identity as TokenIdentity);
  try {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // storage bị chặn thì vẫn dùng danh tính từ token trong phiên này
  }
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => identityFromStorage());
  const navigate = useNavigate();

  // `notify = false` dùng khi kết thúc phiên vì tab khác vừa đăng nhập tài khoản
  // khác: tránh phát lại message và làm các tab khác đăng xuất dây chuyền.
  const endSession = useCallback(
    (notify: boolean) => {
      clearSession();
      setUser(null);
      // Về /login KHÔNG kèm state.from: nếu giữ lại, người đăng nhập sau (vai trò
      // khác) sẽ bị đưa về đúng trang mà người trước vừa xem.
      navigate('/login', { replace: true });
      if (notify) {
        broadcastAuth('logout');
      }
    },
    [navigate],
  );

  const logout = useCallback(() => endSession(true), [endSession]);

  // 401 ở bất kỳ call nào → kết thúc phiên ngay.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  // Tab khác đăng nhập tài khoản khác ⇒ phiên ở tab này không còn hợp lệ.
  useEffect(() => {
    return subscribeAuth((message) => {
      if (message.kind === 'logout') {
        endSession(false);
        return;
      }
      const mine = decodeToken(getToken())?.username;
      if (message.kind === 'login' && message.username && message.username !== mine) {
        endSession(false);
      }
    });
  }, [endSession]);

  // Trang được khôi phục từ bfcache (bấm Back) giữ nguyên heap cũ, có thể là
  // tài khoản trước → nạp lại để trạng thái luôn khớp token hiện tại.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        window.location.reload();
      }
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    // Xoá phiên cũ trước khi đăng nhập: không thể trộn state của hai tài khoản.
    clearSession();
    setUser(null);

    const response = await loginRequest(username, password);
    setToken(response.accessToken);

    const identity = decodeToken(response.accessToken);
    if (isExpired(identity)) {
      clearSession();
      throw new Error('Token không hợp lệ.');
    }

    const nextUser = toUser(identity as TokenIdentity);
    try {
      sessionStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    } catch {
      // bỏ qua
    }
    setUser(nextUser);
    broadcastAuth('login', nextUser.username);
    return nextUser;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      role: user?.role ?? '',
      isAdmin: user?.role === 'Admin',
      canSell: user?.role === 'Admin' || user?.role === 'Sales',
      login,
      logout,
    }),
    [user, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth phải được dùng bên trong <AuthProvider>.');
  }
  return context;
}
