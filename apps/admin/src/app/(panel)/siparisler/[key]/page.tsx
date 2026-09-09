'use client';

import {
  ORDER_STATUS_LABELS_TR,
  ROLE_LABELS_TR,
  UOM_LABELS_TR,
  type OrderStatus,
  type Role,
  type Uom,
} from '@rc/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { StatusBadge } from '@/components/status-badge';
import { formatDateTime, formatMoney } from '@/lib/format';
import { trpc } from '@/lib/trpc';

export default function OrderDetailPage(): ReactNode {
  const params = useParams<{ key: string }>();
  const key = decodeURIComponent(params.key);
  const utils = trpc.useUtils();

  const { data: order, isLoading, isError } = trpc.orders.get.useQuery({ order: key });
  const transition = trpc.orders.transition.useMutation({
    onSuccess: () => {
      void utils.orders.get.invalidate({ order: key });
      void utils.orders.list.invalidate();
    },
  });

  const run = (to: OrderStatus): void => {
    const note =
      to === 'cancelled' || to === 'delivery_issue'
        ? window.prompt('Açıklama (opsiyonel):') ?? undefined
        : undefined;
    transition.mutate({ order: key, to, note });
  };

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !order)
    return (
      <div className="empty">
        <strong>Sipariş bulunamadı</strong>
        <Link href="/siparisler" className="btn btn--sm">
          Panoya dön
        </Link>
      </div>
    );

  return (
    <div className="stack">
      <div className="spread">
        <div className="row">
          <Link href="/siparisler" className="btn btn--sm btn--ghost">
            ← Pano
          </Link>
          <h2 style={{ fontVariantNumeric: 'tabular-nums' }}>{order.keyCode}</h2>
          <StatusBadge status={order.status} />
        </div>
        <strong style={{ fontSize: 18 }}>{formatMoney(order.total, order.currency)}</strong>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 32 }}>
          <div>
            <div className="field__label">Şube</div>
            <div>{order.branchName}</div>
          </div>
          <div>
            <div className="field__label">Oluşturuldu</div>
            <div>{formatDateTime(order.createdAt)}</div>
          </div>
          <div>
            <div className="field__label">Ara toplam</div>
            <div>{formatMoney(order.subtotal, order.currency)}</div>
          </div>
        </div>
        {order.note && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Not: {order.note}
          </p>
        )}
      </div>

      {order.nextSteps.length > 0 && (
        <div className="card" style={{ padding: 16 }}>
          <div className="field__label" style={{ marginBottom: 10 }}>
            İşlem
          </div>
          <div className="row">
            {order.nextSteps.map((step) => {
              const danger = step.to === 'cancelled';
              return (
                <button
                  key={step.to}
                  className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}
                  disabled={transition.isPending}
                  onClick={() => run(step.to)}
                >
                  {step.labelTr}
                </button>
              );
            })}
          </div>
          {transition.isError && (
            <p style={{ color: 'var(--danger)', marginBottom: 0 }}>
              {(transition.error as { message?: string }).message ?? 'İşlem tamamlanamadı.'}
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Ürün</th>
              <th className="table__num">Miktar</th>
              <th className="table__num">Birim Fiyat</th>
              <th className="table__num">Tutar</th>
              <th>Kaynak</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((l) => (
              <tr key={l.id} style={{ cursor: 'default' }}>
                <td>{l.name}</td>
                <td className="table__num">
                  {l.qty} {UOM_LABELS_TR[l.uom as Uom]}
                </td>
                <td className="table__num">{formatMoney(l.unitPrice, order.currency)}</td>
                <td className="table__num">{formatMoney(l.lineTotal, order.currency)}</td>
                <td className="muted">{l.source === 'customer' ? 'Müşteri' : 'Üretici'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="field__label" style={{ marginBottom: 12 }}>
          Geçmiş
        </div>
        <div className="timeline">
          {order.events.map((e, i) => (
            <div className="tl-item" key={i}>
              <div className="tl-dot tl-dot--done" />
              <div>
                <div style={{ fontWeight: 550 }}>
                  {e.toStatus
                    ? ORDER_STATUS_LABELS_TR[e.toStatus as OrderStatus]
                    : e.type}
                </div>
                <div className="muted" style={{ fontSize: 12.5 }}>
                  {formatDateTime(e.createdAt)}
                  {e.actorRole ? ` · ${ROLE_LABELS_TR[e.actorRole as Role]}` : ''}
                  {e.note ? ` · ${e.note}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
