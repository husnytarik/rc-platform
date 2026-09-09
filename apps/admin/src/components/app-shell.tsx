'use client';

import { ROLE_LABELS_TR } from '@rc/shared';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { NAV } from '@/nav';
import { useAuth } from '@/providers/auth-context';

export function AppShell({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  const { identity, can, logout } = useAuth();

  const visible = NAV.filter((item) => can(item.cap));
  const active = visible.find(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  const title = active?.label ?? 'Genel Bakış';
  const roleLabel = identity?.roles?.[0] ? ROLE_LABELS_TR[identity.roles[0]] : null;

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="sidebar__brand">
          <span className="sidebar__dot" />
          RoasteryClub
        </div>
        <Link href="/" className={`navlink${pathname === '/' ? ' navlink--active' : ''}`}>
          Genel Bakış
        </Link>
        {visible.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={`navlink${item === active ? ' navlink--active' : ''}`}
          >
            {item.label}
            {!item.ready && <span className="navlink__badge">yakında</span>}
          </Link>
        ))}
      </nav>

      <div className="main">
        <header className="topbar">
          <span className="topbar__title">{title}</span>
          <div className="row">
            <div style={{ textAlign: 'right', lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600 }}>{identity?.fullName ?? identity?.phone ?? '—'}</div>
              {roleLabel && (
                <div className="muted" style={{ fontSize: 12 }}>
                  {roleLabel}
                </div>
              )}
            </div>
            <button className="btn btn--sm btn--ghost" onClick={logout}>
              Çıkış
            </button>
          </div>
        </header>
        <div className="content">
          {identity?.pending && (
            <div
              className="card"
              style={{ padding: 16, marginBottom: 16, borderColor: 'var(--warning)' }}
            >
              Hesabınız henüz onaylanmadı. Yönetici onayından sonra tüm bölümler açılır.
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
