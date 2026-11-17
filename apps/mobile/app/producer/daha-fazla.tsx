import { MoreMenuScreen } from '@/components/MoreMenuScreen';
import { PRODUCER_NAV } from '@/nav';
import { useAuth } from '@/providers/auth-context';

export default function DahaFazla() {
  const { can } = useAuth();
  const items = PRODUCER_NAV.filter((i) => !i.primary && can(i.cap)).map((i) => ({
    icon: i.icon,
    label: i.label,
    hint: i.hint,
    href: i.href,
  }));
  return (
    <MoreMenuScreen
      items={[
        ...items,
        ...(can('content.manage')
          ? []
          : [{ icon: 'book-outline', label: 'Reçeteler', hint: 'Günün reçetesi ve barista tarifleri', href: '/producer/tarifler' }]),
        { icon: 'notifications-outline', label: 'Bildirimler', hint: 'Sipariş ve talep bildirimleri', href: '/producer/bildirimler' },
        { icon: 'person-outline', label: 'Hesap', hint: 'Profil, çıkış, hesabı sil', href: '/producer/hesap' },
      ]}
    />
  );
}
