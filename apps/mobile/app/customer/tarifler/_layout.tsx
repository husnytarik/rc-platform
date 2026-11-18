import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/customer"
      title="Reçeteler"
      screens={{
      '[id]': 'Reçete',
      }}
    />
  );
}
