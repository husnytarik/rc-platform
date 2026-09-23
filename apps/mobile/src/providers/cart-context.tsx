import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface CartLine {
  variantId: string;
  productName: string;
  variantName: string;
  orderUomLabel: string;
  minOrderQty: number;
  qtyStep: number;
  /** Sunucudan formatlı para dizesi olarak gelir (örn. "12.50") — parasal yuvarlama sunucuda. */
  unitPrice: string | null;
  currency: string | null;
  qty: number;
}

interface CartContextValue {
  lines: CartLine[];
  totalQty: number;
  addLine: (line: Omit<CartLine, 'qty'>, qty: number) => void;
  setQty: (variantId: string, qty: number) => void;
  removeLine: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** Sepet, oturum belleğinde tutulur — sipariş gönderilince veya çıkış yapılınca temizlenir. */
export function CartProvider({ children }: { children: ReactNode }): ReactNode {
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartContextValue>(() => {
    const addLine: CartContextValue['addLine'] = (line, qty) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.variantId === line.variantId);
        if (idx === -1) return [...prev, { ...line, qty }];
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      });
    };

    const setQty: CartContextValue['setQty'] = (variantId, qty) => {
      setLines((prev) =>
        qty <= 0
          ? prev.filter((l) => l.variantId !== variantId)
          : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
      );
    };

    const removeLine: CartContextValue['removeLine'] = (variantId) =>
      setLines((prev) => prev.filter((l) => l.variantId !== variantId));

    const clear = (): void => setLines([]);

    return {
      lines,
      totalQty: lines.reduce((sum, l) => sum + l.qty, 0),
      addLine,
      setQty,
      removeLine,
      clear,
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart <CartProvider> içinde kullanılmalı');
  return ctx;
}
