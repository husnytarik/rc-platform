import { MoreMenuScreen } from '@/components/MoreMenuScreen';

export default function DahaFazla() {
  return (
    <MoreMenuScreen
      items={[
        { icon: 'book-outline', label: 'Reçeteler', hint: 'Günün reçetesi ve barista tarifleri', href: '/customer/tarifler' },
        { icon: 'chatbubbles-outline', label: 'Destek', hint: 'Sorun ve taleplerinizi bize iletin', href: '/customer/destek' },
        { icon: 'construct-outline', label: 'Servisler', hint: 'Servis talebi oluşturun', href: '/customer/servisler' },
        { icon: 'notifications-outline', label: 'Bildirimler', hint: 'Sipariş ve duyuru bildirimleri', href: '/customer/bildirimler' },
        { icon: 'person-outline', label: 'Hesap', hint: 'Profil, çıkış, hesabı sil', href: '/customer/hesap' },
      ]}
    />
  );
}
