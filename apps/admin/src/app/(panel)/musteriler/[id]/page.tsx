'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatDateTime, formatMoney, relativeAge } from '@/lib/format';
import { trpc } from '@/lib/trpc';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function CustomerDetailPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const utils = trpc.useUtils();

  const { data: c, isLoading, isError } = trpc.customer.get.useQuery({ id });

  const setActive = trpc.customer.setActive.useMutation({
    onSuccess: () => {
      void utils.customer.get.invalidate({ id });
      void utils.customer.list.invalidate();
    },
  });

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !c)
    return (
      <div className="empty">
        <strong>Müşteri bulunamadı</strong>
        <Link href="/musteriler" className="btn btn--sm">
          Listeye dön
        </Link>
      </div>
    );

  const toggle = (): void => {
    const next = !c.isActive;
    const msg = next
      ? `${c.name} yeniden aktifleştirilsin mi?`
      : `${c.name} pasife alınsın mı? Firma sipariş veremez hale gelir.`;
    if (window.confirm(msg)) setActive.mutate({ id, isActive: next });
  };

  return (
    <div className="stack">
      <div className="spread">
        <div className="row">
          <Link href="/musteriler" className="btn btn--sm btn--ghost">
            ← Müşteriler
          </Link>
          <h2>{c.name}</h2>
          <span
            className="badge"
            style={{ color: c.isActive ? 'var(--success)' : 'var(--text-muted)' }}
          >
            {c.isActive ? 'Aktif' : 'Pasif'}
          </span>
        </div>
        <button
          className={c.isActive ? 'btn btn--sm btn--danger' : 'btn btn--sm btn--primary'}
          disabled={setActive.isPending}
          onClick={toggle}
        >
          {setActive.isPending
            ? 'Kaydediliyor…'
            : c.isActive
              ? 'Pasife al'
              : 'Aktifleştir'}
        </button>
      </div>

      {setActive.isError && (
        <p style={{ color: 'var(--danger)', margin: 0 }}>
          {errText(setActive.error, 'İşlem tamamlanamadı.')}
        </p>
      )}

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="field__label">Vergi no</div>
            <div>{c.taxId ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">Telefon</div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{c.phone ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">E-posta</div>
            <div>{c.email ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">Kayıt</div>
            <div>{formatDateTime(c.createdAt)}</div>
          </div>
          <div>
            <div className="field__label">Slug</div>
            <div className="muted">{c.slug}</div>
          </div>
        </div>
        {c.address && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Adres: {c.address}
          </p>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="field__label" style={{ padding: '12px 16px 0' }}>
          Şubeler ({c.branches.length})
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Adres</th>
              <th>Telefon</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {c.branches.map((b) => (
              <tr key={b.id} style={{ cursor: 'default' }}>
                <td>{b.name}</td>
                <td className="muted">{b.address ?? '—'}</td>
                <td className="muted">{b.phone ?? '—'}</td>
                <td className="muted">{b.isActive ? 'Aktif' : 'Pasif'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="field__label" style={{ padding: '12px 16px 0' }}>
          Kullanıcılar ({c.members.length})
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Telefon</th>
              <th>Rol</th>
              <th>Durum</th>
            </tr>
          </thead>
          <tbody>
            {c.members.map((m) => (
              <tr key={m.membershipId} style={{ cursor: 'default' }}>
                <td>{m.fullName ?? '—'}</td>
                <td style={{ fontVariantNumeric: 'tabular-nums' }}>{m.phone}</td>
                <td>{m.roleLabel}</td>
                <td className="muted">{m.status === 'active' ? 'Aktif' : 'Askıda'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="field__label" style={{ padding: '12px 16px 0' }}>
          Son siparişler ({c.recentOrders.length})
        </div>
        {c.recentOrders.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            Henüz sipariş yok.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Durum</th>
                <th className="table__num">Tutar</th>
                <th className="table__num">Yaş</th>
              </tr>
            </thead>
            <tbody>
              {c.recentOrders.map((o) => (
                <tr key={o.id} style={{ cursor: 'default' }}>
                  <td>
                    <Link href={`/siparisler/${o.keyCode}`}>{o.keyCode}</Link>
                  </td>
                  <td>{o.statusLabel}</td>
                  <td className="table__num">{formatMoney(o.total)}</td>
                  <td className="table__num muted">{relativeAge(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
