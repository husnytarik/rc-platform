'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
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

const PRICE_SOURCE_LABEL: Record<string, string> = {
  customer: 'Müşteriye özel',
  customer_group: 'Grup',
  default: 'Varsayılan',
  base: 'Temel',
};

export default function ProductDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError } = trpc.catalog.product.useQuery({ id });

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !p)
    return (
      <div className="empty">
        <strong>Ürün bulunamadı</strong>
        <Link href="/katalog" className="btn btn--sm">
          Listeye dön
        </Link>
      </div>
    );

  return (
    <div className="stack">
      <div className="row">
        <Link href="/katalog" className="btn btn--sm btn--ghost">
          ← Katalog
        </Link>
        <h2>{p.name}</h2>
        {p.allowPreorder && (
          <span className="badge" style={{ color: 'var(--accent)' }}>
            Ön siparişe açık
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="field__label">Kod</div>
            <div className="muted">{p.code}</div>
          </div>
          <div>
            <div className="field__label">Marka</div>
            <div>{p.brand ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">Kategori</div>
            <div>{p.categoryName ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">Slug</div>
            <div className="muted">{p.slug}</div>
          </div>
        </div>
        {p.description && (
          <p className="muted" style={{ marginBottom: 0 }}>
            {p.description}
          </p>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="field__label" style={{ padding: '12px 16px 0' }}>
          Varyantlar ({p.variants.length})
        </div>
        {p.variants.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            Aktif varyant yok.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Varyant</th>
                <th>Kod</th>
                <th>Birim</th>
                <th className="table__num">Min. sipariş</th>
                <th className="table__num">Adım</th>
                <th className="table__num">Fiyat</th>
                <th>Kaynak</th>
                <th>Stok</th>
                <th className="table__num">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => {
                const badge = STOCK_META[v.stock.badge as StockBadge];
                return (
                  <tr key={v.id} style={{ cursor: 'default' }}>
                    <td style={{ fontWeight: 600 }}>{v.name}</td>
                    <td className="muted">{v.code}</td>
                    <td className="muted">
                      {v.orderUomLabel}
                      {v.content ? ` (${v.content.amount} ${v.content.uomLabel})` : ''}
                    </td>
                    <td className="table__num">{v.minOrderQty}</td>
                    <td className="table__num">{v.qtyStep}</td>
                    <td className="table__num">
                      {v.price ? formatMoney(v.price.unitPrice, v.price.currency) : '—'}
                    </td>
                    <td className="muted">{v.price ? PRICE_SOURCE_LABEL[v.price.source] : '—'}</td>
                    <td>
                      <span className="badge" style={{ color: badge.color }}>
                        <span className="badge__dot" />
                        {badge.label}
                      </span>
                    </td>
                    <td className="table__num">{v.stock.available ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
