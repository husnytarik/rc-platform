import { Icon, type IconName } from '@/components/Icon';

/** Alt sekme ikonu: aktifken dolu, pasifken çizgi. `name` = Ionicons adı (-outline eki olmadan). */
export function tabIcon(name: string) {
  return function TabGlyph({ focused, color }: { focused: boolean; color: string }) {
    return <Icon name={(focused ? name : `${name}-outline`) as IconName} size={24} color={color} />;
  };
}
