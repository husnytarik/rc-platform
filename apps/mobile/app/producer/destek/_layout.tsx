import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Destek"
      screens={{
      '[id]': 'Destek talebi',
      }}
    />
  );
}
