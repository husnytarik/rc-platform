import Link from 'next/link';
import type { ReactNode } from 'react';

export default function NotFound(): ReactNode {
  return (
    <div className="center-screen">
      <div className="card auth-card stack" style={{ textAlign: 'center' }}>
        <strong style={{ fontSize: 18 }}>Sayfa bulunamadı</strong>
        <span className="muted">Aradığınız bölüm taşınmış veya henüz hazır değil.</span>
        <Link href="/" className="btn btn--primary btn--sm">
          Genel bakışa dön
        </Link>
      </div>
    </div>
  );
}
