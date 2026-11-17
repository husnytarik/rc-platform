import { ORDER_STATUS_LABELS_TR, ORDER_STATUS_META, type OrderStatus } from '@rc/shared';
import { useRouter, type Href } from 'expo-router';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@/components/Icon';
import { TodayRecipeCard } from '@/components/RecipeScreens';
import { useAuth } from '@/providers/auth-context';
import { useCart } from '@/providers/cart-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing, shadow } from '@/theme';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** Müşteri ana sayfası: karşılama, yeni sipariş, bekleyen taslak, son siparişler, kısayollar ve duyurular. */
export function HomeScreen() {
  const router = useRouter();
  const { identity } = useAuth();
  const cart = useCart();
  const utils = trpc.useUtils();
  const feed = trpc.announcement.feed.useQuery();
  const recent = trpc.orders.list.useQuery({ limit: 3 });
  const tip = trpc.recipe.tipToday.useQuery();
  const newest = trpc.catalog.newest.useQuery();
  const first = identity?.fullName?.split(' ')[0];
  const go = (href: string): void => router.push(href as Href);
  const refreshing = feed.isFetching || recent.isFetching;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            void feed.refetch();
            void recent.refetch();
            void utils.recipe.today.invalidate();
            void tip.refetch();
            void newest.refetch();
          }}
        />
      }
    >
      <View>
        <Text style={styles.greet}>{greeting()}</Text>
        <Text style={styles.hello}>{first ?? 'Hoş geldin'}</Text>
      </View>

      <TouchableOpacity style={styles.hero} activeOpacity={0.9} onPress={() => go('/customer/katalog')}>
        <View style={styles.heroTexts}>
          <Text style={styles.heroTitle}>Yeni sipariş ver</Text>
          <Text style={styles.heroSub}>Kataloğa göz at, ürünleri siparişine ekle.</Text>
        </View>
        <View style={styles.heroIconWrap}>
          <Icon name="cafe" size={34} color="#fff" />
        </View>
      </TouchableOpacity>

      {cart.totalQty > 0 && (
        <TouchableOpacity style={styles.draft} activeOpacity={0.9} onPress={() => go('/customer/siparislerim')}>
          <View style={styles.draftDot} />
          <View style={styles.flex}>
            <Text style={styles.draftTitle}>Gönderilmemiş siparişin var</Text>
            <Text style={styles.draftSub}>{cart.totalQty} kalem seni bekliyor</Text>
          </View>
          <Text style={styles.draftCta}>Gönder ›</Text>
        </TouchableOpacity>
      )}

      <TodayRecipeCard base="/customer" />

      {tip.data && (
        <View style={styles.tipCard}>
          <Icon name="bulb" size={22} color={colors.accent} />
          <View style={styles.flex}>
            <Text style={styles.tipHead}>{tip.data.title ?? 'Günün ipucu'}</Text>
            <Text style={styles.tipBody}>{tip.data.body}</Text>
          </View>
        </View>
      )}

      {newest.data && newest.data.length > 0 && (
        <>
          <View style={styles.sectionRow}>
            <Text style={styles.section}>Yeni ürünler</Text>
            <TouchableOpacity onPress={() => go('/customer/katalog')}>
              <Text style={styles.link}>Katalog</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.newRow}>
            {newest.data.map((p) => (
              <TouchableOpacity key={p.id} style={styles.newCard} onPress={() => go('/customer/katalog')}>
                {p.imageUrl ? (
                  <Image source={{ uri: p.imageUrl }} style={styles.newImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.newImg, styles.newImgEmpty]}>
                    <Icon name="cafe-outline" size={28} color={colors.inkFaint} />
                  </View>
                )}
                <Text style={styles.newName} numberOfLines={2}>
                  {p.name}
                </Text>
                {p.brand ? <Text style={styles.newBrand}>{p.brand}</Text> : null}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      <View style={styles.tiles}>
        <Tile icon="cube-outline" label="Siparişlerim" onPress={() => go('/customer/siparislerim')} />
        <Tile icon="construct-outline" label="Servisler" onPress={() => go('/customer/servisler')} />
        <Tile icon="chatbubbles-outline" label="Destek" onPress={() => go('/customer/destek')} />
      </View>

      <View style={styles.sectionRow}>
        <Text style={styles.section}>Son siparişler</Text>
        <TouchableOpacity onPress={() => go('/customer/siparislerim')}>
          <Text style={styles.link}>Tümü</Text>
        </TouchableOpacity>
      </View>
      {recent.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : recent.data && recent.data.items.length > 0 ? (
        recent.data.items.map((o) => {
          const meta = ORDER_STATUS_META[o.status as OrderStatus];
          return (
            <TouchableOpacity
              key={o.id}
              style={styles.order}
              onPress={() => go(`/customer/siparislerim/${o.id}`)}
            >
              <View style={styles.flex}>
                <Text style={styles.orderTitle}>{o.keyCode}</Text>
                <Text style={styles.orderMeta}>
                  {o.branchName} · {o.lineCount} kalem
                </Text>
              </View>
              <View style={styles.orderRight}>
                <Text style={styles.orderTotal}>
                  {o.total} {o.currency}
                </Text>
                <Text style={[styles.orderStatus, { color: meta.color }]}>
                  {ORDER_STATUS_LABELS_TR[o.status as OrderStatus]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.empty}>Henüz siparişin yok. Katalogdan ilk siparişini oluştur.</Text>
      )}

      <Text style={[styles.section, { marginTop: spacing(2) }]}>Duyurular</Text>
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

function Tile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.tile} onPress={onPress}>
      <View style={styles.tileIconWrap}>
        <Icon name={icon} size={22} color={colors.accent} />
      </View>
      <Text style={styles.tileText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tipCard: {
    flexDirection: 'row',
    gap: spacing(3),
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing(4),
  },
  tipHead: { fontSize: 13, fontWeight: '800', color: colors.accent },
  tipBody: { fontSize: 14, color: colors.ink, lineHeight: 20, marginTop: 2 },
  newRow: { gap: spacing(3) },
  newCard: { width: 130, backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(2.5), gap: spacing(1), ...shadow.card },
  newImg: { width: '100%', height: 90, borderRadius: radius.sm, backgroundColor: colors.bg },
  newImgEmpty: { alignItems: 'center', justifyContent: 'center' },
  newName: { fontSize: 13, fontWeight: '700', color: colors.ink },
  newBrand: { fontSize: 11, color: colors.inkMuted },
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(3), paddingBottom: spacing(10) },
  greet: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  hello: { fontSize: 26, fontWeight: '800', color: colors.ink },
  hero: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing(5),
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
  },
  heroTexts: { flex: 1, gap: spacing(1) },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13 },
  heroIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  draft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(3),
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderStyle: 'dashed',
    padding: spacing(3.5),
  },
  draftDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  draftTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  draftSub: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  draftCta: { color: colors.accent, fontWeight: '800', fontSize: 14 },
  tiles: { flexDirection: 'row', gap: spacing(2.5) },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing(4),
    alignItems: 'center',
    gap: spacing(1.5), ...shadow.card },
  tileIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  tileText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing(2) },
  section: { fontSize: 16, fontWeight: '800', color: colors.ink },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { fontSize: 13, color: colors.inkMuted },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    gap: spacing(3), ...shadow.card },
  orderTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  orderMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  orderRight: { alignItems: 'flex-end', gap: 2 },
  orderTotal: { fontSize: 14, fontWeight: '800', color: colors.ink },
  orderStatus: { fontSize: 11, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    gap: spacing(1), ...shadow.card },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.ink },
  cardBody: { fontSize: 13, color: colors.ink },
  cardDate: { fontSize: 11, color: colors.inkFaint },
});
