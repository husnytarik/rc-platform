import { MoreMenuScreen } from '@/components/MoreMenuScreen';

export default function DahaFazla() {
  return (
    <MoreMenuScreen
      items={[
        { icon: '📖', label: 'Reçeteler', hint: 'Günün reçetesi ve barista tarifleri', href: '/customer/tarifler' },
        { icon: '💬', label: 'Destek', hint: 'Sorun ve taleplerinizi bize iletin', href: '/customer/destek' },
        { icon: '🛠️', label: 'Servisler', hint: 'Servis talebi oluşturun', href: '/customer/servisler' },
        { icon: '🔔', label: 'Bildirimler', hint: 'Sipariş ve duyuru bildirimleri', href: '/customer/bildirimler' },
        { icon: '👤', label: 'Hesap', hint: 'Profil, çıkış, hesabı sil', href: '/customer/hesap' },
      ]}
    />
  );
}
