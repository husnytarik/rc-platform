'use client';

import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from '@/providers/auth-context';

/** Oturum yoksa /giris'e yollar; kontrol sürerken tam ekran bekletir. */
export function AuthGate({ children }: { children: ReactNode }): ReactNode {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === 'anonymous') router.replace('/giris');
  }, [status, router]);

  if (status !== 'authenticated') {
    return (
      <div className="center-screen">
        <span className="muted">Yükleniyor…</span>
      </div>
    );
  }
  return <>{children}</>;
}
