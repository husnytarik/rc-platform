import { Text } from 'react-native';

/** Alt sekme ikonu. Ek ikon kütüphanesi gerektirmesin diye (OTA ile güvenle gider) emoji kullanır. */
export function tabIcon(glyph: string) {
  return function TabGlyph({ focused }: { focused: boolean }) {
    return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{glyph}</Text>;
  };
}
