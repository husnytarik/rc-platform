'use client';

import { ORDER_STATUS_LABELS_TR, ORDER_STATUSES, type OrderStatus } from '@rc/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { formatMoney, relativeAge } from '@/lib/format';
import { trpc } from '@/lib/trpc';

function isStatus(value: string | null): value is OrderStatus {
  return value !== null && (ORDER_STATUSES as readonly string[]).includes(value);
}

function Board(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('status');
  const status = isStatus(raw) ? raw : undefined;

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.orders.list.useInfiniteQuery(
      { status, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );

  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  const setStatus = (next?: OrderStatus): void => {
    router.push(next ? `/siparisler?status=${next}` : '/siparisler');
  };

  return (
    <div className="stack">
      <div className="spread">
        <h2>Sipariş Panosu</h2>
        <span className="muted">{rows.length} sipariş</span>
      </div>

      <div className="chips">
        <button
          className={`chip${status === undefined ? ' chip--active' : ''}`}
          onClick={() => setStatus(undefined)}
        >
          Tümü
        </button>
        {ORDER_STATUSES.map((s) => (
          <button
            key={s}
            className={`chip${status === s ? ' chip--active' : ''}`}
            onClick={() => setStatus(s)}
          >
            {ORDER_STATUS_LABELS_TR[s]}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 16 }} className="stack">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        ) : isError ? (
          <div className="empty">Siparişler yüklenemedi.</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <strong>Bu filtrede sipariş yok</strong>
            <span>Farklı bir durum seç ya da tümünü görüntüle.</span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Şube</th>
                <th className="table__num">Kalem</th>
                <th className="table__num">Tutar</th>
                <th>Durum</th>
                <th className="table__num">Yaş</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} onClick={() => router.push(`/siparisler/${o.keyCode}`)}>
                  <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{o.keyCode}</td>
                  <td>{o.branchName}</td>
                  <td className="table__num">{o.lineCount}</td>
                  <td className="table__num">{formatMoney(o.total, o.currency)}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="table__num muted">{relativeAge(o.createdAt)}</td>
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

export default function OrdersPage(): ReactNode {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <Board />
    </Suspense>
  );
}
