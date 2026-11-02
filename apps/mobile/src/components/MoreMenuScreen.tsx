import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export interface MoreMenuItem {
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
          <Text style={styles.label}>{it.label}</Text>
          {it.hint && <Text style={styles.hint}>{it.hint}</Text>}
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
    gap: spacing(0.5),
  },
  label: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { fontSize: 12, color: colors.inkMuted },
});
