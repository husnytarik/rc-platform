'use client';

import { GoogleLogin } from '@react-oauth/google';
import { useEffect, useState, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';

function errMessage(error: unknown, fallback: string): string {
  const msg = (error as { message?: string } | undefined)?.message;
  return msg && msg.length < 200 ? msg : fallback;
}

export default function LoginPage(): ReactNode {
  const { status, login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const oauthLogin = trpc.auth.oauthLogin.useMutation();

  useEffect(() => {
    if (status === 'authenticated') window.location.replace('/');
  }, [status]);

  return (
    <div className="center-screen">
      <div className="card auth-card stack">
        <div className="row" style={{ gap: 10 }}>
          <span className="sidebar__dot" />
          <h1 style={{ fontSize: 18 }}>RoasteryClub Yönetim</h1>
        </div>

        <p className="muted" style={{ margin: 0, fontSize: 13 }}>
          Ekip hesabınla Google ile giriş yap. Hesabın henüz tanımlı değilse bir yönetici
          onaylayana kadar erişim bekletilir.
        </p>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <GoogleLogin
            onSuccess={(cred) => {
              setError(null);
              if (!cred.credential) {
                setError('Google oturumu alınamadı.');
                return;
              }
              oauthLogin.mutate(
                { provider: 'google', idToken: cred.credential },
                {
                  onSuccess: (session) => {
                    login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
                  },
                  onError: (e) => setError(errMessage(e, 'Giriş başarısız oldu.')),
                },
              );
            }}
            onError={() => setError('Google ile giriş başarısız oldu.')}
            locale="tr"
          />
        </div>

        {oauthLogin.isPending && (
          <p className="muted" style={{ margin: 0, fontSize: 12.5, textAlign: 'center' }}>
            Giriş yapılıyor…
          </p>
        )}
        {error && (
          <p style={{ color: 'var(--danger)', margin: 0, textAlign: 'center' }}>{error}</p>
        )}
      </div>
    </div>
  );
}
