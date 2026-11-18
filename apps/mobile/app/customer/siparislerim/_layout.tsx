import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/customer"
      title="Siparişlerim"
      screens={{
      '[id]': 'Sipariş',
      }}
    />
  );
}
