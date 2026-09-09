'use client';

import { ORDER_STATUS_LABELS_TR, ORDER_STATUS_META, type OrderStatus } from '@rc/shared';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';

const OPEN_STATUSES: OrderStatus[] = [
  'placed',
  'confirmed',
  'in_production',
  'production_done',
  'ready_to_ship',
  'in_transit',
];

export default function DashboardPage(): ReactNode {
  const { data, isLoading, isError } = trpc.orders.list.useQuery({ limit: 100 });

  const items = data?.items ?? [];
  const counts = new Map<OrderStatus, number>();
  let openTotal = 0;
  for (const o of items) {
    counts.set(o.status, (counts.get(o.status) ?? 0) + 1);
    if (OPEN_STATUSES.includes(o.status)) openTotal += Number(o.total);
  }

  return (
    <div className="stack">
      <h2>Genel Bakış</h2>

      {isLoading && <div className="skeleton" style={{ height: 96 }} />}
      {isError && <div className="card" style={{ padding: 16 }}>Siparişler yüklenemedi.</div>}

      {!isLoading && !isError && (
        <>
          <div
            style={{
              display: 'grid',
              gap: 12,
              gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            }}
          >
            {OPEN_STATUSES.map((s) => (
              <Link key={s} href={`/siparisler?status=${s}`} className="card" style={{ padding: 14 }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: ORDER_STATUS_META[s].color }}>
                  {counts.get(s) ?? 0}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {ORDER_STATUS_LABELS_TR[s]}
                </div>
              </Link>
            ))}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div className="spread">
              <span className="muted">Açık siparişlerin toplam tutarı</span>
              <strong style={{ fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(openTotal)}
              </strong>
            </div>
          </div>

          <Link href="/siparisler" className="btn" style={{ alignSelf: 'flex-start' }}>
            Sipariş panosuna git
          </Link>
        </>
      )}
    </div>
  );
}
