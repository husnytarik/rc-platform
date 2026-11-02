import { MoreMenuScreen } from '@/components/MoreMenuScreen';

export default function DahaFazla() {
  return (
    <MoreMenuScreen
      items={[
        { label: 'Destek', hint: 'Sorun ve taleplerinizi bize iletin', href: '/customer/destek' },
        { label: 'Servisler', hint: 'Servis talebi oluşturun', href: '/customer/servisler' },
        { label: 'Bildirimler', hint: 'Sipariş ve duyuru bildirimleri', href: '/customer/bildirimler' },
        { label: 'Hesap', hint: 'Profil, çıkış, hesabı sil', href: '/customer/hesap' },
      ]}
    />
  );
}
