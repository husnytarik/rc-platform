'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
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

interface Variant {
  price: { unitPrice: string; currency: string } | null;
  stock: { badge: StockBadge; available: number | null };
}

function priceRange(variants: Variant[]): string {
  const prices = variants.map((v) => Number(v.price?.unitPrice ?? 0)).filter((n) => n > 0);
  if (prices.length === 0) return '—';
  const currency = variants.find((v) => v.price)?.price?.currency ?? 'TRY';
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

function worstBadge(variants: Variant[]): StockBadge {
  const badges = new Set(variants.map((v) => v.stock.badge));
  return BADGE_PRIORITY.find((b) => badges.has(b)) ?? 'in';
}

function List(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();
  const categorySlug = params.get('kategori') ?? undefined;
  const search = params.get('q') ?? '';
  const [term, setTerm] = useState(search);

  const pushParams = (next: { kategori?: string; q?: string }): void => {
    const sp = new URLSearchParams(params.toString());
    if (next.kategori !== undefined) {
      next.kategori ? sp.set('kategori', next.kategori) : sp.delete('kategori');
    }
    if (next.q !== undefined) {
      next.q ? sp.set('q', next.q) : sp.delete('q');
    }
    router.push(`/katalog${sp.toString() ? `?${sp}` : ''}`);
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    pushParams({ q: term.trim() });
  };

  const { data: categories } = trpc.catalog.categories.useQuery();

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.catalog.list.useInfiniteQuery(
      { limit: 30, ...(categorySlug ? { categorySlug } : {}), ...(search ? { search } : {}) },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );

  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="stack">
      <div className="spread">
        <h2>Katalog</h2>
        <span className="muted">{rows.length} ürün</span>
      </div>

      <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="chips">
          <button
            className={`chip${!categorySlug ? ' chip--active' : ''}`}
            onClick={() => pushParams({ kategori: '' })}
          >
            Tümü
          </button>
          {(categories ?? []).map((c) => (
            <button
              key={c.id}
              className={`chip${categorySlug === c.slug ? ' chip--active' : ''}`}
              onClick={() => pushParams({ kategori: c.slug })}
            >
              {c.name}
            </button>
          ))}
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
          <div className="empty">Katalog yüklenemedi.</div>
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
                <th>Marka</th>
                <th>Kategori</th>
                <th className="table__num">Varyant</th>
                <th className="table__num">Fiyat</th>
                <th>Stok</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const badge = STOCK_META[worstBadge(p.variants)];
                return (
                  <tr key={p.id} onClick={() => router.push(`/katalog/${p.id}`)}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td className="muted">{p.brand ?? '—'}</td>
                    <td className="muted">{p.categoryName ?? '—'}</td>
                    <td className="table__num">{p.variants.length}</td>
                    <td className="table__num">{priceRange(p.variants)}</td>
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

export default function CatalogPage(): ReactNode {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <List />
    </Suspense>
  );
}
