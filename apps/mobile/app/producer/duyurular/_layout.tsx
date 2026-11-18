import { AppStack } from '@/components/AppStack';

export default function Layout() {
  return (
    <AppStack
      base="/producer"
      title="Duyurular"
      screens={{
      yeni: 'Yeni duyuru',
      }}
    />
  );
}
