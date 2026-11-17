import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

const DIFF_TR: Record<string, string> = { kolay: 'Kolay', orta: 'Orta', zor: 'Zor' };

interface Item {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string | null;
  category: string;
  prepMinutes: number;
  difficulty: string;
}

function Meta({ r }: { r: Item }) {
  return (
    <Text style={styles.meta}>
      {r.category} · {r.prepMinutes} dk · {DIFF_TR[r.difficulty] ?? r.difficulty}
    </Text>
  );
}

/** Ana sayfa kartı — "Günün reçetesi". */
export function TodayRecipeCard({ base }: { base: '/customer' | '/producer' }) {
  const router = useRouter();
  const q = trpc.recipe.today.useQuery();
  const r = q.data;
  if (!r) return null;
  return (
    <TouchableOpacity
      style={styles.today}
      activeOpacity={0.9}
      onPress={() => router.push(`${base}/tarifler/${r.id}` as Href)}
    >
      {r.imageUrl && <Image source={{ uri: r.imageUrl }} style={styles.todayImg} resizeMode="cover" />}
      <View style={styles.todayBody}>
        <Text style={styles.todayBadge}>GÜNÜN REÇETESİ</Text>
        <Text style={styles.todayTitle}>{r.title}</Text>
        {r.subtitle && <Text style={styles.sub}>{r.subtitle}</Text>}
        <Meta r={r} />
      </View>
    </TouchableOpacity>
  );
}

export function RecipeListScreen({ base }: { base: '/customer' | '/producer' }) {
  const router = useRouter();
  const list = trpc.recipe.list.useQuery();
  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={list.isFetching} onRefresh={() => void list.refetch()} />}
    >
      <TodayRecipeCard base={base} />
      <Text style={styles.section}>Tüm reçeteler</Text>
      {list.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : (
        list.data?.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={styles.row}
            onPress={() => router.push(`${base}/tarifler/${r.id}` as Href)}
          >
            {r.imageUrl ? <Image source={{ uri: r.imageUrl }} style={styles.thumb} /> : <View style={styles.thumb} />}
            <View style={styles.flexTxt}>
              <Text style={styles.rowTitle}>{r.title}</Text>
              {r.subtitle && (
                <Text style={styles.sub} numberOfLines={1}>
                  {r.subtitle}
                </Text>
              )}
              <Meta r={r} />
            </View>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

export function RecipeDetailScreen({ id }: { id: string }) {
  const q = trpc.recipe.get.useQuery({ id });
  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  const r = q.data;
  if (!r) return <Text style={styles.err}>Reçete bulunamadı.</Text>;
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.detail}>
      {r.imageUrl && <Image source={{ uri: r.imageUrl }} style={styles.hero} resizeMode="cover" />}
      <View style={styles.detailBody}>
        <Text style={styles.h1}>{r.title}</Text>
        {r.subtitle && <Text style={styles.sub}>{r.subtitle}</Text>}
        <View style={styles.chips}>
          <Text style={styles.chip}>{r.prepMinutes} dk</Text>
          <Text style={styles.chip}>{r.servings} kişilik</Text>
          <Text style={styles.chip}>{DIFF_TR[r.difficulty] ?? r.difficulty}</Text>
          <Text style={styles.chip}>{r.category}</Text>
        </View>
        {r.description && <Text style={styles.desc}>{r.description}</Text>}

        <Text style={styles.section}>Malzemeler</Text>
        {r.ingredients.map((x, i) => (
          <Text key={i} style={styles.li}>
            • {x}
          </Text>
        ))}

        <Text style={styles.section}>Hazırlanışı</Text>
        {r.steps.map((x, i) => (
          <View key={i} style={styles.step}>
            <Text style={styles.stepNo}>{i + 1}</Text>
            <Text style={styles.stepText}>{x}</Text>
          </View>
        ))}

        {r.tip && (
          <View style={styles.tip}>
            <Text style={styles.tipTitle}>Barista ipucu</Text>
            <Text style={styles.stepText}>{r.tip}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3), paddingBottom: spacing(10) },
  today: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden', ...shadow.card },
  todayImg: { width: '100%', height: 170 },
  todayBody: { padding: spacing(4), gap: 2 },
  todayBadge: { fontSize: 11, fontWeight: '800', color: colors.accent, letterSpacing: 0.5 },
  todayTitle: { fontSize: 20, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 13, color: colors.inkMuted },
  meta: { fontSize: 12, color: colors.inkFaint, marginTop: 2 },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink, marginTop: spacing(2) },
  row: { flexDirection: 'row', gap: spacing(3), backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(2.5), alignItems: 'center', ...shadow.card },
  thumb: { width: 72, height: 72, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  flexTxt: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  err: { textAlign: 'center', marginTop: 40, color: colors.inkMuted },
  detail: { paddingBottom: spacing(10) },
  hero: { width: '100%', height: 260 },
  detailBody: { padding: spacing(5), gap: spacing(2) },
  h1: { fontSize: 26, fontWeight: '800', color: colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginTop: spacing(1) },
  chip: { backgroundColor: colors.accentSoft, color: colors.accent, fontSize: 12, fontWeight: '700', paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: radius.pill, overflow: 'hidden' },
  desc: { fontSize: 14, color: colors.ink, marginTop: spacing(1), lineHeight: 20 },
  li: { fontSize: 14, color: colors.ink, lineHeight: 22 },
  step: { flexDirection: 'row', gap: spacing(3), alignItems: 'flex-start' },
  stepNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.accent, color: '#fff', textAlign: 'center', lineHeight: 24, fontWeight: '800', fontSize: 12, overflow: 'hidden' },
  stepText: { flex: 1, fontSize: 14, color: colors.ink, lineHeight: 20 },
  tip: { backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: spacing(3.5), gap: spacing(1), marginTop: spacing(2) },
  tipTitle: { fontWeight: '800', color: colors.accent, fontSize: 13 },
});
