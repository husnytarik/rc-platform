import { MoreMenuScreen } from '@/components/MoreMenuScreen';
import { PRODUCER_NAV } from '@/nav';
import { useAuth } from '@/providers/auth-context';

export default function DahaFazla() {
  const { can } = useAuth();
  const items = PRODUCER_NAV.filter((i) => !i.primary && can(i.cap)).map((i) => ({
    label: i.label,
    hint: i.hint,
    href: i.href,
  }));
  return (
    <MoreMenuScreen
      items={[
        ...items,
        { label: 'Bildirimler', hint: 'Sipariş ve talep bildirimleri', href: '/producer/bildirimler' },
        { label: 'Hesap', hint: 'Profil, çıkış, hesabı sil', href: '/producer/hesap' },
      ]}
    />
  );
}
