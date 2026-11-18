import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Reçeteler"
      screens={{
      yeni: 'Yeni reçete',
      duzenle: 'Reçeteyi düzenle',
      '[id]': 'Reçete',
      }}
    />
  );
}
