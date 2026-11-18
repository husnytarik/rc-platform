import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Katalog"
      screens={{
      yeni: 'Yeni Ürün',
      '[id]': 'Ürün Düzenle',
      }}
    />
  );
}
