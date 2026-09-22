'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';

type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';

const STOCK_META: Record<StockBadge, { label: string; color: string }> = {
  in: { label: 'Stokta', color: 'var(--success)' },
  low: { label: 'Az kaldı', color: 'var(--warning)' },
  out: { label: 'Tükendi', color: 'var(--danger)' },
  preorder: { label: 'Ön sipariş', color: 'var(--accent)' },
  incoming: { label: 'Yolda', color: 'var(--accent)' },
  closed: { label: 'Kapalı', color: 'var(--text-muted)' },
};
// Tabloda tek satırda özetlemek için en "dikkat çeken" rozet öne çıkar.
const BADGE_PRIORITY: StockBadge[] = ['out', 'low', 'closed', 'incoming', 'preorder', 'in'];
const ATTENTION_BADGES: StockBadge[] = ['out', 'low'];

interface Variant {
  code: string;
  name: string;
  stock: { badge: StockBadge; available: number | null };
}

function worstBadge(variants: Variant[]): StockBadge {
  const badges = new Set(variants.map((v) => v.stock.badge));
  return BADGE_PRIORITY.find((b) => badges.has(b)) ?? 'in';
}

function totalBalance(variants: Variant[]): number | null {
  if (variants.some((v) => v.stock.available == null)) return null;
  return variants.reduce((sum, v) => sum + (v.stock.available ?? 0), 0);
}

function List(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();
  const search = params.get('q') ?? '';
  const onlyAttention = params.get('durum') === 'dikkat';
  const [term, setTerm] = useState(search);

  const pushParams = (next: { q?: string; durum?: string }): void => {
    const sp = new URLSearchParams(params.toString());
    if (next.q !== undefined) {
      next.q ? sp.set('q', next.q) : sp.delete('q');
    }
    if (next.durum !== undefined) {
      next.durum ? sp.set('durum', next.durum) : sp.delete('durum');
    }
    router.push(`/stok${sp.toString() ? `?${sp}` : ''}`);
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    pushParams({ q: term.trim() });
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.catalog.list.useInfiniteQuery(
      { limit: 30, ...(search ? { search } : {}) },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );

  const allRows = data?.pages.flatMap((p) => p.items) ?? [];
  const rows = onlyAttention
    ? allRows.filter((p) => ATTENTION_BADGES.includes(worstBadge(p.variants)))
    : allRows;

  return (
    <div className="stack">
      <div className="spread">
        <h2>Stok</h2>
        <span className="muted">{rows.length} ürün</span>
      </div>

      <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="chips">
          <button
            className={`chip${!onlyAttention ? ' chip--active' : ''}`}
            onClick={() => pushParams({ durum: '' })}
          >
            Tümü
          </button>
          <button
            className={`chip${onlyAttention ? ' chip--active' : ''}`}
            onClick={() => pushParams({ durum: 'dikkat' })}
          >
            Dikkat gerektirenler
          </button>
        </div>
        <form onSubmit={onSubmit} className="row" style={{ gap: 8 }}>
          <input
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Ürün adı"
            style={{ minWidth: 200 }}
          />
          <button className="btn btn--sm" type="submit">
            Ara
          </button>
          {search && (
            <button
              type="button"
              className="btn btn--sm btn--ghost"
              onClick={() => {
                setTerm('');
                pushParams({ q: '' });
              }}
            >
              Temizle
            </button>
          )}
        </form>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 16 }} className="stack">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        ) : isError ? (
          <div className="empty">Stok yüklenemedi.</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <strong>Ürün yok</strong>
            <span>Filtreyi değiştir ya da aramayı temizle.</span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th className="table__num">Varyant</th>
                <th className="table__num">Toplam bakiye</th>
                <th>Durum</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const badge = STOCK_META[worstBadge(p.variants)];
                const total = totalBalance(p.variants);
                return (
                  <tr key={p.id} onClick={() => router.push(`/stok/${p.id}`)}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="table__num">{p.variants.length}</td>
                    <td className="table__num">{total ?? '—'}</td>
                    <td>
                      <span className="badge" style={{ color: badge.color }}>
                        <span className="badge__dot" />
                        {badge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {hasNextPage && (
        <button
          className="btn"
          style={{ alignSelf: 'center' }}
          disabled={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
        >
          {isFetchingNextPage ? 'Yükleniyor…' : 'Daha fazla'}
        </button>
      )}
    </div>
  );
}

export default function StockPage(): ReactNode {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <List />
    </Suspense>
  );
}
