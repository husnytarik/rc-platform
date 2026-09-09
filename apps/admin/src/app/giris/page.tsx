'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';

function errMessage(error: unknown, fallback: string): string {
  const msg = (error as { message?: string } | undefined)?.message;
  return msg && msg.length < 200 ? msg : fallback;
}

export default function LoginPage(): ReactNode {
  const { status, login } = useAuth();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [notice, setNotice] = useState<string | null>(null);

  const requestOtp = trpc.auth.requestOtp.useMutation();
  const verifyOtp = trpc.auth.verifyOtp.useMutation();

  useEffect(() => {
    if (status === 'authenticated') window.location.replace('/');
  }, [status]);

  const onRequest = (e: FormEvent): void => {
    e.preventDefault();
    setNotice(null);
    requestOtp.mutate(
      { phone: phone.trim(), purpose: 'login' },
      {
        onSuccess: (res) => {
          setStep('code');
          setNotice(
            `Kod gönderildi (${res.expiresInSec} sn geçerli). Geliştirmede kod API log'unda.`,
          );
        },
      },
    );
  };

  const onVerify = (e: FormEvent): void => {
    e.preventDefault();
    setNotice(null);
    verifyOtp.mutate(
      { phone: phone.trim(), code: code.trim() },
      {
        onSuccess: (session) => {
          login({ accessToken: session.accessToken, refreshToken: session.refreshToken });
        },
      },
    );
  };

  return (
    <div className="center-screen">
      <div className="card auth-card stack">
        <div className="row" style={{ gap: 10 }}>
          <span className="sidebar__dot" />
          <h1 style={{ fontSize: 18 }}>RoasteryClub Yönetim</h1>
        </div>

        {step === 'phone' ? (
          <form className="stack" onSubmit={onRequest}>
            <div className="field">
              <label className="field__label" htmlFor="phone">
                Telefon
              </label>
              <input
                id="phone"
                className="input"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+90 5xx xxx xx xx"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <button className="btn btn--primary" type="submit" disabled={requestOtp.isPending}>
              {requestOtp.isPending ? 'Gönderiliyor…' : 'Kod gönder'}
            </button>
            {requestOtp.isError && (
              <p style={{ color: 'var(--danger)', margin: 0 }}>
                {errMessage(requestOtp.error, 'Kod gönderilemedi.')}
              </p>
            )}
          </form>
        ) : (
          <form className="stack" onSubmit={onVerify}>
            <div className="field">
              <label className="field__label" htmlFor="code">
                Doğrulama kodu
              </label>
              <input
                id="code"
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6 haneli kod"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <button
              className="btn btn--primary"
              type="submit"
              disabled={verifyOtp.isPending || code.length !== 6}
            >
              {verifyOtp.isPending ? 'Doğrulanıyor…' : 'Giriş yap'}
            </button>
            <button
              className="btn btn--ghost btn--sm"
              type="button"
              onClick={() => {
                setStep('phone');
                setCode('');
                setNotice(null);
              }}
            >
              Telefonu değiştir
            </button>
            {verifyOtp.isError && (
              <p style={{ color: 'var(--danger)', margin: 0 }}>
                {errMessage(verifyOtp.error, 'Kod doğrulanamadı.')}
              </p>
            )}
          </form>
        )}

        {notice && (
          <p className="muted" style={{ margin: 0, fontSize: 12.5 }}>
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
