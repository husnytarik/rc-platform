'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { NAV_BY_KEY } from '@/nav';
import { useAuth } from '@/providers/auth-context';

/** Route'u hazır ama ekranı henüz gelmemiş bölümler için "yakında" kabuğu. */
export default function SectionPlaceholder(): ReactNode {
  const { section } = useParams<{ section: string }>();
  const { can } = useAuth();
  const item = NAV_BY_KEY[section];

  if (!item || item.ready) notFound();

  if (!can(item.cap)) {
    return <div className="empty">Bu bölüm için yetkiniz yok.</div>;
  }

  return (
    <div className="stack">
      <h2>{item.label}</h2>
      <div className="card empty" style={{ padding: 24 }}>
        <strong>Bu bölüm yakında</strong>
        <span style={{ maxWidth: 420 }}>{item.planned}</span>
        <Link href="/siparisler" className="btn btn--sm">
          Sipariş panosuna dön
        </Link>
      </div>
    </div>
  );
}
