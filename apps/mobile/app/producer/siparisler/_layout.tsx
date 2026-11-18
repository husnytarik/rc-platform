import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Siparişler"
      screens={{
      '[id]': 'Sipariş',
      }}
    />
  );
}
