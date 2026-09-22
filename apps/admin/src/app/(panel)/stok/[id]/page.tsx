'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Fragment, useState, type ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import { trpc } from '@/lib/trpc';

type StockBadge = 'in' | 'low' | 'out' | 'preorder' | 'incoming' | 'closed';
type StockReason = 'purchase' | 'production_in' | 'order_reserve' | 'order_release' | 'adjustment' | 'correction';
type ManualReason = 'purchase' | 'production_in' | 'adjustment' | 'correction';
type DisplayState = 'in_stock' | 'limited' | 'preorder' | 'incoming' | 'closed';

const STOCK_META: Record<StockBadge, { label: string; color: string }> = {
  in: { label: 'Stokta', color: 'var(--success)' },
  low: { label: 'Az kaldı', color: 'var(--warning)' },
  out: { label: 'Tükendi', color: 'var(--danger)' },
  preorder: { label: 'Ön sipariş', color: 'var(--accent)' },
  incoming: { label: 'Yolda', color: 'var(--accent)' },
  closed: { label: 'Kapalı', color: 'var(--text-muted)' },
};

const MANUAL_REASONS: { value: ManualReason; label: string }[] = [
  { value: 'purchase', label: 'Satın alma girişi' },
  { value: 'production_in', label: 'Üretimden giriş' },
  { value: 'adjustment', label: 'Elle düzeltme' },
  { value: 'correction', label: 'Hata düzeltme' },
];

const REASON_LABEL: Record<StockReason, string> = {
  purchase: 'Satın alma girişi',
  production_in: 'Üretimden giriş',
  order_reserve: 'Sipariş rezervi',
  order_release: 'Sipariş iptali/iadesi',
  adjustment: 'Elle düzeltme',
  correction: 'Hata düzeltme',
};

const DISPLAY_STATE_META: Record<DisplayState, { label: string; color: string }> = {
  in_stock: { label: 'Stokta (elle sabitle)', color: 'var(--success)' },
  limited: { label: 'Az kaldı', color: 'var(--warning)' },
  preorder: { label: 'Ön sipariş', color: 'var(--accent)' },
  incoming: { label: 'Yolda', color: 'var(--accent)' },
  closed: { label: 'Kapalı', color: 'var(--text-muted)' },
};
const DISPLAY_STATE_OPTIONS = (Object.keys(DISPLAY_STATE_META) as DisplayState[]).map((value) => ({
  value,
  label: DISPLAY_STATE_META[value].label,
}));

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function OverrideCard({ productId }: { productId: string }): ReactNode {
  const utils = trpc.useUtils();
  const { data: override, isLoading } = trpc.stock.override.useQuery({ productId });
  const [state, setState] = useState<DisplayState>('in_stock');
  const [note, setNote] = useState('');

  const invalidate = (): void => {
    void utils.stock.override.invalidate({ productId });
    void utils.catalog.product.invalidate({ id: productId });
    void utils.catalog.list.invalidate();
  };
  const setOverride = trpc.stock.setOverride.useMutation({ onSuccess: invalidate });
  const clearOverride = trpc.stock.clearOverride.useMutation({ onSuccess: invalidate });

  if (isLoading) return <div className="skeleton" style={{ height: 100 }} />;

  return (
    <div className="card stack" style={{ padding: 16 }}>
      <div className="spread">
        <div className="field__label">Gösterim override</div>
        {override && (
          <span className="muted" style={{ fontSize: 12.5 }}>
            {formatDateTime(override.updatedAt)} itibarıyla
          </span>
        )}
      </div>

      {override ? (
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="badge" style={{ color: DISPLAY_STATE_META[override.state as DisplayState].color }}>
              <span className="badge__dot" />
              {DISPLAY_STATE_META[override.state as DisplayState].label}
            </span>
            {override.note && <span className="muted" style={{ marginLeft: 10 }}>{override.note}</span>}
          </div>
          <button
            className="btn btn--sm btn--ghost"
            disabled={clearOverride.isPending}
            onClick={() => clearOverride.mutate({ productId })}
          >
            {clearOverride.isPending ? 'Kaldırılıyor…' : 'Kaldır (otomatiğe dön)'}
          </button>
        </div>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          Şu an override yok — müşteri gerçek bakiyeden hesaplanan durumu görüyor.
        </p>
      )}

      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <select
          className="select"
          style={{ width: 220 }}
          value={state}
          onChange={(e) => setState(e.target.value as DisplayState)}
        >
          {DISPLAY_STATE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 220 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Not (opsiyonel)"
        />
        <button
          className="btn btn--sm btn--primary"
          disabled={setOverride.isPending}
          onClick={() =>
            setOverride.mutate(
              { productId, state, note: note.trim() || undefined },
              { onSuccess: () => setNote('') },
            )
          }
        >
          {setOverride.isPending ? 'Kaydediliyor…' : 'Uygula'}
        </button>
      </div>
      {(setOverride.isError || clearOverride.isError) && (
        <p style={{ color: 'var(--danger)', margin: 0 }}>
          {errText(setOverride.error ?? clearOverride.error, 'İşlem tamamlanamadı.')}
        </p>
      )}
    </div>
  );
}

function LedgerPanel({ variantId, productId }: { variantId: string; productId: string }): ReactNode {
  const utils = trpc.useUtils();
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<ManualReason>('purchase');
  const [note, setNote] = useState('');

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.stock.ledger.useInfiniteQuery(
      { variantId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );
  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  const adjust = trpc.stock.adjust.useMutation({
    onSuccess: () => {
      setDelta('');
      setNote('');
      void utils.stock.ledger.invalidate({ variantId });
      void utils.catalog.product.invalidate({ id: productId });
      void utils.catalog.list.invalidate();
    },
  });

  const parsedDelta = Number(delta.replace(',', '.'));
  const canSubmit = delta.trim() !== '' && Number.isFinite(parsedDelta) && parsedDelta !== 0;

  return (
    <div className="stack" style={{ padding: '4px 0 12px' }}>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ width: 140 }}
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+10 / -5"
          inputMode="decimal"
        />
        <select
          className="select"
          style={{ width: 200 }}
          value={reason}
          onChange={(e) => setReason(e.target.value as ManualReason)}
        >
          {MANUAL_REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          style={{ width: 220 }}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Not (opsiyonel)"
        />
        <button
          className="btn btn--sm btn--primary"
          disabled={!canSubmit || adjust.isPending}
          onClick={() =>
            adjust.mutate({ variantId, delta: parsedDelta, reason, note: note.trim() || undefined })
          }
        >
          {adjust.isPending ? 'Ekleniyor…' : 'Hareket ekle'}
        </button>
      </div>
      {adjust.isError && (
        <p style={{ color: 'var(--danger)', margin: 0 }}>{errText(adjust.error, 'Hareket eklenemedi.')}</p>
      )}

      <div style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div className="skeleton" style={{ height: 60 }} />
        ) : isError ? (
          <div className="empty">Defter yüklenemedi.</div>
        ) : rows.length === 0 ? (
          <div className="muted" style={{ padding: '8px 0' }}>
            Hareket yok.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Neden</th>
                <th className="table__num">Miktar</th>
                <th>Not</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td className="muted">{formatDateTime(r.createdAt)}</td>
                  <td>{REASON_LABEL[r.reason as StockReason]}</td>
                  <td
                    className="table__num"
                    style={{ color: r.delta > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}
                  >
                    {r.delta > 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="muted">{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {hasNextPage && (
        <button
          className="btn btn--sm"
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

export default function StockDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { data: p, isLoading, isError } = trpc.catalog.product.useQuery({ id });
  const [openVariant, setOpenVariant] = useState<string | null>(null);

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !p)
    return (
      <div className="empty">
        <strong>Ürün bulunamadı</strong>
        <Link href="/stok" className="btn btn--sm">
          Listeye dön
        </Link>
      </div>
    );

  return (
    <div className="stack">
      <div className="row">
        <Link href="/stok" className="btn btn--sm btn--ghost">
          ← Stok
        </Link>
        <h2>{p.name}</h2>
      </div>

      <OverrideCard productId={p.id} />

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
                <th>Durum</th>
                <th className="table__num">Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {p.variants.map((v) => {
                const badge = STOCK_META[v.stock.badge as StockBadge];
                const isOpen = openVariant === v.id;
                return (
                  <Fragment key={v.id}>
                    <tr onClick={() => setOpenVariant(isOpen ? null : v.id)}>
                      <td style={{ fontWeight: 600 }}>{v.name}</td>
                      <td className="muted">{v.code}</td>
                      <td className="muted">{v.orderUomLabel}</td>
                      <td>
                        <span className="badge" style={{ color: badge.color }}>
                          <span className="badge__dot" />
                          {badge.label}
                        </span>
                      </td>
                      <td className="table__num">{v.stock.available ?? '—'}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ cursor: 'default' }}>
                        <td colSpan={5} style={{ background: 'var(--surface-2)' }}>
                          <LedgerPanel variantId={v.id} productId={p.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
