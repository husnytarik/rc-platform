import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/customer"
      title="Destek"
      screens={{
      yeni: 'Yeni talep',
      '[id]': 'Destek talebi',
      }}
    />
  );
}
