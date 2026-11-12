import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { draftStore } from '@/lib/draft-store';
import { useAuth } from '@/providers/auth-context';

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

/**
 * Gönderilmemiş sipariş (taslak). Kullanıcıya "sepet" değil, "Gönderilmemiş sipariş" olarak görünür;
 * "Siparişi gönder" ile onaylanınca gerçek siparişe dönüşür. Cihazda kullanıcı başına saklanır.
 */
interface DraftContextValue {
  lines: CartLine[];
  totalQty: number;
  branchId: string | null;
  note: string;
  setBranchId: (id: string | null) => void;
  setNote: (note: string) => void;
  addLine: (line: Omit<CartLine, 'qty'>, qty: number) => void;
  setQty: (variantId: string, qty: number) => void;
  removeLine: (variantId: string) => void;
  /** Taslağı boşaltır ve cihazdan siler (gönderim sonrası veya "Taslağı sil"). */
  clear: () => void;
}

const CartContext = createContext<DraftContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }): ReactNode {
  const { identity } = useAuth();
  const userId = identity?.id ?? null;
  const [lines, setLines] = useState<CartLine[]>([]);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const loadedFor = useRef<string | null>(null);

  // Kullanıcı değişince o kullanıcının taslağını yükle; çıkışta belleği boşalt (dosya kalır).
  useEffect(() => {
    loadedFor.current = null;
    setLines([]);
    setBranchId(null);
    setNote('');
    if (!userId) return;
    let cancelled = false;
    void draftStore.load(userId).then((d) => {
      if (cancelled) return;
      if (d) {
        setLines(Array.isArray(d.lines) ? (d.lines as CartLine[]) : []);
        setBranchId(d.branchId ?? null);
        setNote(d.note ?? '');
      }
      loadedFor.current = userId;
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Değişiklikleri cihaza yaz (yükleme bitmeden yazma: mevcut taslağı ezmesin).
  useEffect(() => {
    if (!userId || loadedFor.current !== userId) return;
    if (lines.length === 0 && !note) void draftStore.clear(userId);
    else void draftStore.save(userId, { lines, branchId, note });
  }, [userId, lines, branchId, note]);

  const value = useMemo<DraftContextValue>(() => {
    const addLine: DraftContextValue['addLine'] = (line, qty) => {
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.variantId === line.variantId);
        if (idx === -1) return [...prev, { ...line, qty }];
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        return next;
      });
    };

    const setQty: DraftContextValue['setQty'] = (variantId, qty) => {
      setLines((prev) =>
        qty <= 0
          ? prev.filter((l) => l.variantId !== variantId)
          : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l)),
      );
    };

    const removeLine: DraftContextValue['removeLine'] = (variantId) =>
      setLines((prev) => prev.filter((l) => l.variantId !== variantId));

    const clear = (): void => {
      setLines([]);
      setNote('');
      setBranchId(null);
    };

    return {
      lines,
      totalQty: lines.length,
      branchId,
      note,
      setBranchId,
      setNote,
      addLine,
      setQty,
      removeLine,
      clear,
    };
  }, [lines, branchId, note]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): DraftContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart <CartProvider> içinde kullanılmalı');
  return ctx;
}
