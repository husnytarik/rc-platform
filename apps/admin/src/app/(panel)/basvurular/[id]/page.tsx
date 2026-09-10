'use client';

import { ROLE_LABELS_TR } from '@rc/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { formatDateTime } from '@/lib/format';
import { trpc } from '@/lib/trpc';

type CustomerRole = 'customer_admin' | 'branch_manager' | 'customer_user';
const CUSTOMER_ROLES: CustomerRole[] = ['customer_admin', 'branch_manager', 'customer_user'];

const STATUS_LABEL: Record<'pending' | 'approved' | 'rejected', string> = {
  pending: 'Bekliyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
};

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function ApplicationDetailPage(): ReactNode {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const utils = trpc.useUtils();

  const { data: req, isLoading, isError } = trpc.membership.request.useQuery({ id });

  const [role, setRole] = useState<CustomerRole>('customer_admin');
  const [note, setNote] = useState('');

  const onSettled = (): void => {
    void utils.membership.requests.invalidate();
    void utils.membership.request.invalidate({ id });
    router.push('/basvurular');
  };
  const approve = trpc.membership.approve.useMutation({ onSuccess: onSettled });
  const reject = trpc.membership.reject.useMutation({ onSuccess: onSettled });

  const busy = approve.isPending || reject.isPending;

  if (isLoading) return <div className="skeleton" style={{ height: 320 }} />;
  if (isError || !req)
    return (
      <div className="empty">
        <strong>Başvuru bulunamadı</strong>
        <Link href="/basvurular" className="btn btn--sm">
          Listeye dön
        </Link>
      </div>
    );

  const decided = req.status !== 'pending';

  return (
    <div className="stack">
      <div className="spread">
        <div className="row">
          <Link href="/basvurular" className="btn btn--sm btn--ghost">
            ← Başvurular
          </Link>
          <h2>{req.requestedOrgName ?? 'Firma adı yok'}</h2>
          <span className="badge">{STATUS_LABEL[req.status]}</span>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="row" style={{ gap: 32, flexWrap: 'wrap' }}>
          <div>
            <div className="field__label">Yetkili</div>
            <div>{req.fullName ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">Telefon</div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{req.phone}</div>
          </div>
          <div>
            <div className="field__label">Vergi no</div>
            <div>{req.taxId ?? '—'}</div>
          </div>
          <div>
            <div className="field__label">İstenen rol</div>
            <div>{req.requestedRole ? ROLE_LABELS_TR[req.requestedRole] : '—'}</div>
          </div>
          <div>
            <div className="field__label">Başvuru tarihi</div>
            <div>{formatDateTime(req.createdAt)}</div>
          </div>
        </div>
        {req.address && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Adres: {req.address}
          </p>
        )}
        {req.note && (
          <p className="muted" style={{ marginBottom: 0 }}>
            Not: {req.note}
          </p>
        )}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <div className="field__label" style={{ padding: '12px 16px 0' }}>
          Şubeler ({req.branches.length})
        </div>
        {req.branches.length === 0 ? (
          <div className="empty" style={{ padding: 16 }}>
            Şube belirtilmemiş — onayda &quot;Merkez Şube&quot; oluşturulur.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Adres</th>
                <th>Telefon</th>
              </tr>
            </thead>
            <tbody>
              {req.branches.map((b, i) => (
                <tr key={i} style={{ cursor: 'default' }}>
                  <td>{b.name}</td>
                  <td className="muted">{b.address ?? '—'}</td>
                  <td className="muted">{b.phone ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {decided ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="field__label">Karar</div>
          <div>
            {STATUS_LABEL[req.status]}
            {req.reviewedAt ? ` · ${formatDateTime(req.reviewedAt)}` : ''}
          </div>
          {req.reviewNote && (
            <p className="muted" style={{ marginBottom: 0 }}>
              {req.reviewNote}
            </p>
          )}
        </div>
      ) : (
        <div className="card stack" style={{ padding: 16 }}>
          <div className="field__label">Karar ver</div>

          <div className="field">
            <label className="field__label" htmlFor="role">
              Atanacak rol
            </label>
            <select
              id="role"
              className="select"
              value={role}
              onChange={(e) => setRole(e.target.value as CustomerRole)}
            >
              {CUSTOMER_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS_TR[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="note">
              Karar notu (ret için zorunlu)
            </label>
            <input
              id="note"
              className="input"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Kısa açıklama"
            />
          </div>

          <div className="row">
            <button
              className="btn btn--primary"
              disabled={busy}
              onClick={() =>
                approve.mutate({ id, role, reviewNote: note.trim() || undefined })
              }
            >
              {approve.isPending ? 'Onaylanıyor…' : 'Onayla'}
            </button>
            <button
              className="btn btn--danger"
              disabled={busy || note.trim().length < 3}
              onClick={() => reject.mutate({ id, reviewNote: note.trim() })}
            >
              {reject.isPending ? 'Reddediliyor…' : 'Reddet'}
            </button>
          </div>

          {(approve.isError || reject.isError) && (
            <p style={{ color: 'var(--danger)', margin: 0 }}>
              {errText(approve.error ?? reject.error, 'İşlem tamamlanamadı.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
