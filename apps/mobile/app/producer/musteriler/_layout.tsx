import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Müşteriler"
      screens={{
      yeni: 'Yeni Firma',
      fiyat: 'Özel Fiyatlar',
      '[id]': 'Firma',
      }}
    />
  );
}
