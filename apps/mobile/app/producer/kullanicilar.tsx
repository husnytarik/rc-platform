import type { AppRouter } from '@rc/api/app-router';
import type { inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@/components/Icon';
import { trpc } from '@/lib/trpc';
import { colors, radius, shadow, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

type Role =
  | 'producer_admin'
  | 'sales_staff'
  | 'production_staff'
  | 'shipping_staff'
  | 'customer_admin'
  | 'branch_manager'
  | 'customer_user';

const STAFF_ROLES: { key: Role; label: string }[] = [
  { key: 'producer_admin', label: 'Yönetici' },
  { key: 'sales_staff', label: 'Satış' },
  { key: 'production_staff', label: 'Üretim' },
  { key: 'shipping_staff', label: 'Sevkiyat' },
];
const CUSTOMER_ROLES: { key: Role; label: string }[] = [
  { key: 'customer_admin', label: 'Müşteri Yöneticisi' },
  { key: 'branch_manager', label: 'Şube Müdürü' },
  { key: 'customer_user', label: 'Müşteri Kullanıcısı' },
];

type Kind = undefined | 'staff' | 'customer';

export default function KullanicilarScreen() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<Kind>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const q = trpc.membership.people.useInfiniteQuery(
    { search: search.trim() || undefined, kind, limit: 30 },
    { getNextPageParam: (l) => l.nextCursor ?? undefined },
  );
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const open = items.find((i) => i.id === openId) ?? null;
  const refresh = (): void => void utils.membership.people.invalidate();

  return (
    <View style={styles.flex}>
      <View style={styles.top}>
        <View style={styles.searchRow}>
          <Icon name="search-outline" size={18} color={colors.inkFaint} />
          <TextInput
            style={styles.search}
            value={search}
            onChangeText={setSearch}
            placeholder="Ad veya telefon ara"
            placeholderTextColor={colors.inkFaint}
          />
        </View>
        <View style={styles.chips}>
          {([
            [undefined, 'Hepsi'],
            ['staff', 'Personel'],
            ['customer', 'Müşteriler'],
          ] as [Kind, string][]).map(([k, label]) => (
            <TouchableOpacity key={label} style={[styles.chip, kind === k && styles.chipOn]} onPress={() => setKind(k)}>
              <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{label}</Text>
            </TouchableOpacity>
          ))}
          <View style={styles.flex} />
          <TouchableOpacity onPress={() => setAdding(true)}>
            <Text style={styles.link}>+ Personel ekle</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.list}
        data={items}
        keyExtractor={(i) => i.id}
        refreshing={q.isFetching && !q.isFetchingNextPage}
        onRefresh={() => void q.refetch()}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) void q.fetchNextPage();
        }}
        ListEmptyComponent={
          q.isLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} /> : <Text style={styles.empty}>Kayıt yok.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setOpenId(item.id)}>
            <View style={styles.cardTop}>
              <Text style={styles.name}>{item.fullName ?? '—'}</Text>
              {item.isStaff && <Text style={styles.staffBadge}>Personel</Text>}
              {!item.isActive && <Text style={styles.suspended}>{item.deletedAt ? 'Silindi' : 'Donduruldu'}</Text>}
            </View>
            <Text style={styles.meta}>{item.phone ?? '—'}</Text>
            {item.memberships.map((m) => (
              <Text key={m.id} style={[styles.meta, m.status === 'suspended' && styles.suspended]}>
                {m.roleLabel} · {m.orgName}
                {m.status === 'suspended' ? ' (askıda)' : ''}
              </Text>
            ))}
          </TouchableOpacity>
        )}
      />

      <PersonModal person={open} onClose={() => setOpenId(null)} onChanged={refresh} />
      <AddStaffModal
        visible={adding}
        onClose={() => setAdding(false)}
        onSaved={() => {
          setAdding(false);
          refresh();
        }}
      />
    </View>
  );
}

type Person = inferRouterOutputs<AppRouter>['membership']['people']['items'][number];

function PersonModal({ person, onClose, onChanged }: { person: Person | null; onClose: () => void; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const set = trpc.membership.setMembership.useMutation();
  const remove = trpc.membership.removeMembership.useMutation();
  const freeze = trpc.membership.setUserActive.useMutation();
  const addStaff = trpc.membership.addStaff.useMutation();
  const busy = set.isPending || remove.isPending || addStaff.isPending || freeze.isPending;
  const cb = {
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError: (e: unknown) => setError(errText(e, 'İşlem başarısız.')),
  };

  return (
    <Modal visible={person !== null} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <ScrollView contentContainerStyle={styles.sheet}>
          {person && (
            <>
              <Text style={styles.h2}>{person.fullName ?? '—'}</Text>
              <Text style={styles.meta}>{person.phone}</Text>
              {person.email ? <Text style={styles.meta}>{person.email}</Text> : null}
              {!person.isActive && (
                <Text style={styles.suspended}>{person.deletedAt ? 'Hesap kullanıcı tarafından silindi' : 'Hesap donduruldu'}</Text>
              )}
              <TouchableOpacity disabled={busy} onPress={() => freeze.mutate({ userId: person.id, active: !person.isActive }, cb)}>
                <Text style={person.isActive ? styles.danger : styles.link}>
                  {person.isActive ? 'Hesabı dondur' : person.deletedAt ? 'Hesabı geri aç' : 'Hesabı çöz'}
                </Text>
              </TouchableOpacity>

              {person.memberships.map((m) => {
                const staff = m.orgType === 'producer';
                const roles = staff ? STAFF_ROLES : CUSTOMER_ROLES;
                return (
                  <View key={m.id} style={styles.block}>
                    <Text style={styles.blockTitle}>
                      {staff ? 'Personel' : 'Müşteri'} · {m.orgName}
                    </Text>
                    <View style={styles.chips}>
                      {roles.map((r) => (
                        <TouchableOpacity
                          key={r.key}
                          disabled={busy}
                          style={[styles.chip, m.role === r.key && styles.chipOn]}
                          onPress={() => m.role !== r.key && set.mutate({ membershipId: m.id, role: r.key }, cb)}
                        >
                          <Text style={[styles.chipText, m.role === r.key && styles.chipTextOn]}>{r.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {staff && m.role === 'sales_staff' && (
                      <View>
                        <Text style={styles.meta}>İskonto limiti (müşteri bu kişiyi seçerse uygulayabilir)</Text>
                        <View style={styles.chips}>
                          {[0, 2, 5, 10, 15, 20].map((pct) => (
                            <TouchableOpacity
                              key={pct}
                              disabled={busy}
                              style={[styles.chip, m.maxDiscountPct === pct && styles.chipOn]}
                              onPress={() => set.mutate({ membershipId: m.id, maxDiscountPct: pct }, cb)}
                            >
                              <Text style={[styles.chipText, m.maxDiscountPct === pct && styles.chipTextOn]}>%{pct}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    )}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        disabled={busy}
                        onPress={() =>
                          set.mutate({ membershipId: m.id, status: m.status === 'active' ? 'suspended' : 'active' }, cb)
                        }
                      >
                        <Text style={styles.link}>{m.status === 'active' ? 'Askıya al' : 'Yeniden etkinleştir'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity disabled={busy} onPress={() => remove.mutate({ membershipId: m.id }, cb)}>
                        <Text style={styles.danger}>Üyeliği iptal et</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <View style={styles.block}>
                <Text style={styles.blockTitle}>{person.isStaff ? 'Başka personel rolü ekle' : 'Personel yap'}</Text>
                <View style={styles.chips}>
                  {STAFF_ROLES.map((r) => (
                    <TouchableOpacity
                      key={r.key}
                      disabled={busy || !person.phone}
                      style={styles.chip}
                      onPress={() => addStaff.mutate({ phone: person.phone!, role: r.key }, cb)}
                    >
                      <Text style={styles.chipText}>+ {r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {error && <Text style={styles.error}>{error}</Text>}
              {busy && <ActivityIndicator color={colors.accent} />}
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.cancel}>Kapat</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

function AddStaffModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<Role>('sales_staff');
  const [error, setError] = useState<string | null>(null);
  const add = trpc.membership.addStaff.useMutation({
    onSuccess: () => {
      setName('');
      setPhone('');
      setError(null);
      onSaved();
    },
    onError: (e) => setError(errText(e, 'Eklenemedi.')),
  });
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.h2}>Personel ekle</Text>
          <Text style={styles.meta}>Numara sistemde kayıtlıysa (örn. bir müşteri) o kişi personel de olur.</Text>
          <Text style={styles.label}>Cep telefonu</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="05XX XXX XX XX" placeholderTextColor={colors.inkFaint} />
          <Text style={styles.label}>Ad soyad (yeni kişi ise)</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} />
          <Text style={styles.label}>Rol</Text>
          <View style={styles.chips}>
            {STAFF_ROLES.map((r) => (
              <TouchableOpacity key={r.key} style={[styles.chip, role === r.key && styles.chipOn]} onPress={() => setRole(r.key)}>
                <Text style={[styles.chipText, role === r.key && styles.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.save, (phone.trim().length < 7 || add.isPending) && { opacity: 0.5 }]}
            disabled={phone.trim().length < 7 || add.isPending}
            onPress={() => add.mutate({ phone: phone.trim(), fullName: name.trim() || undefined, role })}
          >
            {add.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Ekle</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Vazgeç</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  top: { padding: spacing(5), paddingBottom: spacing(2), gap: spacing(2.5) },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: spacing(3), ...shadow.card },
  search: { flex: 1, paddingVertical: spacing(3), fontSize: 14, color: colors.ink },
  list: { padding: spacing(5), paddingTop: spacing(2), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3.5), gap: 2, ...shadow.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: colors.ink },
  staffBadge: { backgroundColor: colors.accentSoft, color: colors.accent, fontSize: 11, fontWeight: '700', paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: radius.pill, overflow: 'hidden' },
  meta: { fontSize: 12, color: colors.inkMuted },
  suspended: { color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), alignItems: 'center' },
  chip: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(1.5) },
  chipOn: { backgroundColor: colors.accentSoft },
  chipText: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  danger: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing(5) },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5), gap: spacing(2.5) },
  h2: { fontSize: 18, fontWeight: '800', color: colors.ink },
  block: { gap: spacing(2), backgroundColor: colors.bg, borderRadius: radius.md, padding: spacing(3.5) },
  blockTitle: { fontSize: 13, fontWeight: '800', color: colors.ink },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing(1) },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600' },
  input: { backgroundColor: colors.bg, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 15, color: colors.ink },
  error: { color: colors.danger, fontSize: 13 },
  save: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  cancel: { color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
});
