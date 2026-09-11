'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent, type ReactNode } from 'react';
import { relativeAge } from '@/lib/format';
import { trpc } from '@/lib/trpc';

type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'Tümü',
  active: 'Aktif',
  inactive: 'Pasif',
};
const STATUS_TABS: StatusFilter[] = ['all', 'active', 'inactive'];

function isStatusFilter(v: string | null): v is StatusFilter {
  return v === 'all' || v === 'active' || v === 'inactive';
}

function List(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();

  const rawStatus = params.get('durum');
  const status: StatusFilter = isStatusFilter(rawStatus) ? rawStatus : 'all';
  const search = params.get('q') ?? '';

  const [term, setTerm] = useState(search);

  const pushParams = (next: { durum?: StatusFilter; q?: string }): void => {
    const sp = new URLSearchParams(params.toString());
    if (next.durum !== undefined) {
      next.durum === 'all' ? sp.delete('durum') : sp.set('durum', next.durum);
    }
    if (next.q !== undefined) {
      next.q ? sp.set('q', next.q) : sp.delete('q');
    }
    router.push(`/musteriler${sp.toString() ? `?${sp}` : ''}`);
  };

  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    pushParams({ q: term.trim() });
  };

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.customer.list.useInfiniteQuery(
      {
        limit: 20,
        ...(status === 'all' ? {} : { status }),
        ...(search ? { search } : {}),
      },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );

  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="stack">
      <div className="spread">
        <h2>Müşteriler</h2>
        <span className="muted">{rows.length} firma</span>
      </div>

      <div className="spread" style={{ gap: 12, flexWrap: 'wrap' }}>
        <div className="chips">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              className={`chip${status === s ? ' chip--active' : ''}`}
              onClick={() => pushParams({ durum: s })}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="row" style={{ gap: 8 }}>
          <input
            className="input"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Firma, vergi no, telefon"
            style={{ minWidth: 220 }}
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
          <div className="empty">Müşteriler yüklenemedi.</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <strong>Kayıt yok</strong>
            <span>Filtreyi değiştir ya da aramayı temizle.</span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Vergi no</th>
                <th>Telefon</th>
                <th className="table__num">Şube</th>
                <th className="table__num">Kullanıcı</th>
                <th className="table__num">Sipariş</th>
                <th>Durum</th>
                <th className="table__num">Yaş</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/musteriler/${r.id}`)}>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.taxId ?? '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.phone ?? '—'}</td>
                  <td className="table__num">{r.branchCount}</td>
                  <td className="table__num">{r.memberCount}</td>
                  <td className="table__num">{r.orderCount}</td>
                  <td>
                    <span
                      className="badge"
                      style={{ color: r.isActive ? 'var(--success)' : 'var(--text-muted)' }}
                    >
                      {r.isActive ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="table__num muted">{relativeAge(r.createdAt)}</td>
                </tr>
              ))}
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

export default function CustomersPage(): ReactNode {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <List />
    </Suspense>
  );
}
