import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/customer"
      title="Servisler"
      screens={{
      '[id]': 'Servis talebi',
      }}
    />
  );
}
