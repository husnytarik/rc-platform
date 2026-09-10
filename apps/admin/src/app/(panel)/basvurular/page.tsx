'use client';

import { ROLE_LABELS_TR } from '@rc/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, type ReactNode } from 'react';
import { relativeAge } from '@/lib/format';
import { trpc } from '@/lib/trpc';

type ReqStatus = 'pending' | 'approved' | 'rejected';

const STATUS_LABEL: Record<ReqStatus, string> = {
  pending: 'Bekleyen',
  approved: 'Onaylanan',
  rejected: 'Reddedilen',
};
const STATUS_TABS: ReqStatus[] = ['pending', 'approved', 'rejected'];

function isReqStatus(v: string | null): v is ReqStatus {
  return v === 'pending' || v === 'approved' || v === 'rejected';
}

function List(): ReactNode {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get('durum');
  const status: ReqStatus = isReqStatus(raw) ? raw : 'pending';

  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.membership.requests.useInfiniteQuery(
      { status, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    );

  const rows = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="stack">
      <div className="spread">
        <h2>Üyelik Başvuruları</h2>
        <span className="muted">{rows.length} başvuru</span>
      </div>

      <div className="chips">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            className={`chip${status === s ? ' chip--active' : ''}`}
            onClick={() => router.push(`/basvurular?durum=${s}`)}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: 16 }} className="stack">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton" style={{ height: 40 }} />
            ))}
          </div>
        ) : isError ? (
          <div className="empty">Başvurular yüklenemedi.</div>
        ) : rows.length === 0 ? (
          <div className="empty">
            <strong>Bu durumda başvuru yok</strong>
            <span>Başka bir sekmeye bak.</span>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Firma</th>
                <th>Yetkili</th>
                <th>Telefon</th>
                <th>İstenen rol</th>
                <th className="table__num">Şube</th>
                <th className="table__num">Yaş</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => router.push(`/basvurular/${r.id}`)}>
                  <td style={{ fontWeight: 600 }}>{r.requestedOrgName ?? '—'}</td>
                  <td>{r.fullName ?? '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.phone}</td>
                  <td>{r.requestedRole ? ROLE_LABELS_TR[r.requestedRole] : '—'}</td>
                  <td className="table__num">{r.branchCount}</td>
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

export default function ApplicationsPage(): ReactNode {
  return (
    <Suspense fallback={<div className="skeleton" style={{ height: 200 }} />}>
      <List />
    </Suspense>
  );
}
