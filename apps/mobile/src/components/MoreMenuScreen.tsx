import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export interface MoreMenuItem {
  icon?: string;
  label: string;
  hint?: string;
  href: string;
}

/** "Daha fazla" sekmesi — alt sekme çubuğuna sığmayan ekranlara giriş. */
export function MoreMenuScreen({ items }: { items: MoreMenuItem[] }) {
  const router = useRouter();
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {items.map((it) => (
        <TouchableOpacity key={it.href} style={styles.row} onPress={() => router.push(it.href as Href)}>
          <View style={styles.iconBox}>
            <Text style={styles.icon}>{it.icon ?? '•'}</Text>
          </View>
          <View style={styles.texts}>
            <Text style={styles.label}>{it.label}</Text>
            {it.hint && <Text style={styles.hint}>{it.hint}</Text>}
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(4),
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  iconBox: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  texts: { flex: 1, gap: 2 },
  chev: { fontSize: 24, color: colors.inkFaint },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkMuted },
});
