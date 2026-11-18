import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Stok"
      screens={{
      '[id]': 'Stok Detayı',
      }}
    />
  );
}
