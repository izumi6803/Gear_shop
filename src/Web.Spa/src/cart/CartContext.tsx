import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  productId: number;
  code: string;
  name: string;
  unitPrice: number;
  quantity: number;
  warehouseId: number;
  available: number;
}

interface CartValue {
  lines: CartLine[];
  count: number;
  subTotal: number;
  tax: number;
  shipping: number;
  total: number;
  add: (line: Omit<CartLine, 'quantity'>, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const KEY = 'stockflow.cart';
const TAX_RATE = 0.1;
// Khớp ShippingPolicy bên backend: dưới 500 USD thu 15 USD, từ 500 miễn phí.
const SHIPPING_FLAT = 15;
const FREE_SHIPPING_THRESHOLD = 500;

const CartContext = createContext<CartValue | null>(null);

function read(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as CartLine[];
    return Array.isArray(parsed) ? parsed.filter((line) => line && line.productId > 0) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => read());

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      // storage bị chặn: giỏ hàng chỉ tồn tại trong phiên
    }
  }, [lines]);

  const add = useCallback((line: Omit<CartLine, 'quantity'>, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((item) => item.productId === line.productId);
      if (existing) {
        return current.map((item) =>
          item.productId === line.productId
            ? { ...item, quantity: item.quantity + quantity, available: line.available }
            : item,
        );
      }
      return [...current, { ...line, quantity }];
    });
  }, []);

  const setQuantity = useCallback((productId: number, quantity: number) => {
    setLines((current) =>
      current
        .map((item) => (item.productId === productId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  }, []);

  const remove = useCallback((productId: number) => {
    setLines((current) => current.filter((item) => item.productId !== productId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => {
    const subTotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
    const tax = Math.round(subTotal * TAX_RATE);
    const shipping = lines.length === 0 ? 0 : subTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
    return {
      lines,
      count: lines.reduce((sum, line) => sum + line.quantity, 0),
      subTotal,
      tax,
      shipping,
      total: subTotal + tax + shipping,
      add,
      setQuantity,
      remove,
      clear,
    };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart phải được dùng bên trong <CartProvider>.');
  }
  return context;
}
