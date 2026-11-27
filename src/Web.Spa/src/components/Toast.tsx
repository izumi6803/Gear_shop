import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

type PushToast = (message: string, kind?: ToastKind) => void;

const ToastContext = createContext<PushToast | null>(null);

const ICONS: Record<ToastKind, IconName> = {
  success: 'check',
  error: 'warning',
  info: 'info',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback<PushToast>((message, kind = 'success') => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, message, kind }]);
    window.setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`app-toast app-toast-${item.kind}`}>
            <Icon name={ICONS[item.kind]} />
            <span>{item.message}</span>
            <button
              type="button"
              className="btn-close btn-close-sm ms-auto"
              aria-label="Đóng"
              onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): PushToast {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast phải được dùng bên trong <ToastProvider>.');
  }
  return context;
}
