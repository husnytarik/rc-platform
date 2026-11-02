import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Müşteri ana sayfası: karşılama, kısayollar ve duyuru akışı. */
export function HomeScreen() {
  const router = useRouter();
  const { identity } = useAuth();
  const feed = trpc.announcement.feed.useQuery();
  const first = identity?.fullName?.split(' ')[0];

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={feed.isFetching} onRefresh={() => void feed.refetch()} />
      }
    >
      <Text style={styles.hello}>Merhaba{first ? `, ${first}` : ''}</Text>

      <View style={styles.shortcuts}>
        <Shortcut label="Katalog" onPress={() => router.push('/customer/katalog' as Href)} />
        <Shortcut label="Siparişlerim" onPress={() => router.push('/customer/siparislerim' as Href)} />
        <Shortcut label="Destek" onPress={() => router.push('/customer/destek' as Href)} />
      </View>

      <Text style={styles.section}>Duyurular</Text>
      {feed.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : feed.data && feed.data.length > 0 ? (
        feed.data.map((a) => (
          <View key={a.id} style={styles.card}>
            <Text style={styles.cardTitle}>{a.title}</Text>
            <Text style={styles.cardBody}>{a.body}</Text>
            {a.publishedAt && (
              <Text style={styles.cardDate}>{new Date(a.publishedAt).toLocaleDateString('tr-TR')}</Text>
            )}
          </View>
        ))
      ) : (
        <Text style={styles.empty}>Şu an duyuru yok.</Text>
      )}
    </ScrollView>
  );
}

function Shortcut({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.shortcut} onPress={onPress}>
      <Text style={styles.shortcutText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  hello: { fontSize: 22, fontWeight: '800', color: colors.ink },
  shortcuts: { flexDirection: 'row', gap: spacing(2), marginVertical: spacing(2) },
  shortcut: {
    flex: 1,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  shortcutText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  section: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: spacing(2) },
  empty: { fontSize: 13, color: colors.inkMuted },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardBody: { fontSize: 13, color: colors.ink },
  cardDate: { fontSize: 11, color: colors.inkFaint },
});
