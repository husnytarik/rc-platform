import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';
import { colors, radius, spacing, shadow } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

type CRole = 'customer_admin' | 'branch_manager' | 'customer_user';
const ROLES: { key: CRole; label: string }[] = [
  { key: 'customer_admin', label: 'Müşteri Yöneticisi' },
  { key: 'branch_manager', label: 'Şube Müdürü' },
  { key: 'customer_user', label: 'Müşteri Kullanıcısı' },
];

interface MemberTarget {
  membershipId?: string;
  fullName: string;
  phone: string;
  role: CRole;
  status: 'active' | 'suspended';
}
interface BranchTarget {
  id?: string;
  name: string;
  address: string;
  phone: string;
}

export default function FirmaDetayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();
  const utils = trpc.useUtils();
  const q = trpc.customer.get.useQuery({ id });
  const [info, setInfo] = useState({ name: '', taxId: '', phone: '', email: '', address: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [member, setMember] = useState<MemberTarget | null>(null);
  const [branch, setBranch] = useState<BranchTarget | null>(null);

  const c = q.data;
  useEffect(() => {
    if (c) setInfo({ name: c.name, taxId: c.taxId ?? '', phone: c.phone ?? '', email: c.email ?? '', address: c.address ?? '' });
  }, [c]);

  const refresh = (): void => {
    void utils.customer.get.invalidate({ id });
    void utils.customer.list.invalidate();
  };
  const update = trpc.customer.update.useMutation({
    onSuccess: () => {
      setMsg('Firma bilgileri kaydedildi.');
      refresh();
    },
    onError: (e) => setMsg(errText(e, 'Kaydedilemedi.')),
  });
  const setActive = trpc.customer.setActive.useMutation({ onSuccess: refresh });

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  if (!c) return <Text style={styles.empty}>Firma bulunamadı.</Text>;

  const nn = (v: string): string | null => (v.trim() ? v.trim() : null);
  const saveInfo = (): void => {
    setMsg(null);
    update.mutate({
      id,
      name: info.name.trim(),
      taxId: nn(info.taxId),
      phone: nn(info.phone),
      email: nn(info.email),
      address: nn(info.address),
    });
  };
  const inp = (label: string, k: keyof typeof info, kb?: 'phone-pad' | 'email-address') => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={info[k]}
        onChangeText={(v) => setInfo((x) => ({ ...x, [k]: v }))}
        keyboardType={kb}
        autoCapitalize={kb === 'email-address' ? 'none' : 'sentences'}
      />
    </>
  );

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.titleRow}>
        <Text style={styles.h1}>{c.name}</Text>
        {!c.isActive && <Text style={styles.badge}>Pasif</Text>}
      </View>

      <Text style={styles.section}>Firma bilgileri</Text>
      {inp('Firma adı', 'name')}
      {inp('Vergi no', 'taxId')}
      {inp('Telefon', 'phone', 'phone-pad')}
      {inp('E-posta', 'email', 'email-address')}
      {inp('Adres', 'address')}
      {msg && <Text style={styles.msg}>{msg}</Text>}
      <TouchableOpacity
        style={[styles.save, (info.name.trim().length < 1 || update.isPending) && styles.disabled]}
        disabled={info.name.trim().length < 1 || update.isPending}
        onPress={saveInfo}
      >
        {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Bilgileri kaydet</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setActive.mutate({ id, isActive: !c.isActive })}>
        <Text style={[styles.link, { color: c.isActive ? colors.danger : colors.accent }]}>
          {c.isActive ? 'Firmayı pasife al' : 'Firmayı aktif et'}
        </Text>
      </TouchableOpacity>

      {can('price.manage') && (
        <TouchableOpacity
          style={styles.row}
          onPress={() => router.push({ pathname: '/producer/musteriler/fiyat', params: { orgId: id, name: c.name } })}
        >
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>Firmaya özel fiyatlar</Text>
            <Text style={styles.rowMeta}>Kategoriye toplu indirim veya ürün bazında fiyat</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.headRow}>
        <Text style={styles.section}>Aboneler / kullanıcılar ({c.members.length})</Text>
        <TouchableOpacity
          onPress={() => setMember({ fullName: '', phone: '', role: 'customer_user', status: 'active' })}
        >
          <Text style={styles.link}>+ Üye ekle</Text>
        </TouchableOpacity>
      </View>
      {c.members.map((m) => (
        <TouchableOpacity
          key={m.membershipId}
          style={styles.row}
          onPress={() =>
            setMember({
              membershipId: m.membershipId,
              fullName: m.fullName ?? '',
              phone: m.phone ?? '',
              role: (ROLES.some((r) => r.key === m.role) ? m.role : 'customer_user') as CRole,
              status: m.status === 'suspended' ? 'suspended' : 'active',
            })
          }
        >
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{m.fullName ?? '—'}</Text>
            <Text style={styles.rowMeta}>
              {m.phone ?? '—'} · {m.roleLabel}
              {m.status === 'suspended' ? ' · Askıda' : ''}
            </Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}

      <View style={styles.headRow}>
        <Text style={styles.section}>Şubeler ({c.branches.length})</Text>
        <TouchableOpacity onPress={() => setBranch({ name: '', address: '', phone: '' })}>
          <Text style={styles.link}>+ Şube ekle</Text>
        </TouchableOpacity>
      </View>
      {c.branches.map((b) => (
        <TouchableOpacity
          key={b.id}
          style={styles.row}
          onPress={() => setBranch({ id: b.id, name: b.name, address: b.address ?? '', phone: b.phone ?? '' })}
        >
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{b.name}</Text>
            {(b.address || b.phone) && <Text style={styles.rowMeta}>{[b.address, b.phone].filter(Boolean).join(' · ')}</Text>}
          </View>
          <Text style={styles.chev}>›</Text>
        </TouchableOpacity>
      ))}

      {c.recentOrders.length > 0 && <Text style={styles.section}>Son siparişler</Text>}
      {c.recentOrders.map((o) => (
        <View key={o.id} style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{o.keyCode}</Text>
            <Text style={styles.rowMeta}>
              {o.statusLabel} · {o.total.toFixed(2)} ₺
            </Text>
          </View>
        </View>
      ))}

      <MemberModal
        orgId={id}
        branches={c.branches}
        target={member}
        onClose={() => setMember(null)}
        onSaved={() => {
          setMember(null);
          refresh();
        }}
      />
      <BranchModal
        orgId={id}
        target={branch}
        onClose={() => setBranch(null)}
        onSaved={() => {
          setBranch(null);
          refresh();
        }}
      />
    </ScrollView>
  );
}

function MemberModal({
  orgId,
  branches,
  target,
  onClose,
  onSaved,
}: {
  orgId: string;
  branches: { id: string; name: string }[];
  target: MemberTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [t, setT] = useState<MemberTarget | null>(null);
  const [scope, setScope] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setT(target);
    setScope([]);
    setError(null);
  }, [target]);

  const add = trpc.customer.addMember.useMutation();
  const upd = trpc.customer.updateMember.useMutation();
  const del = trpc.customer.removeMember.useMutation();
  const busy = add.isPending || upd.isPending || del.isPending;
  const done = { onSuccess: onSaved, onError: (e: unknown) => setError(errText(e, 'İşlem başarısız.')) };

  if (!t) return <Modal visible={false} />;
  const isNew = !t.membershipId;
  const valid = t.fullName.trim().length >= 2 && t.phone.trim().length >= 7;

  const save = (): void => {
    setError(null);
    const branchIds = t.role === 'branch_manager' && scope.length > 0 ? scope : undefined;
    if (isNew) {
      add.mutate({ orgId, fullName: t.fullName.trim(), phone: t.phone.trim(), role: t.role, branchIds }, done);
    } else {
      upd.mutate(
        {
          membershipId: t.membershipId!,
          fullName: t.fullName.trim(),
          phone: t.phone.trim(),
          role: t.role,
          status: t.status,
          branchIds,
        },
        done,
      );
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.h2}>{isNew ? 'Yeni üye' : 'Üyeyi düzenle'}</Text>
          <Text style={styles.label}>Ad soyad</Text>
          <TextInput style={styles.input} value={t.fullName} onChangeText={(v) => setT({ ...t, fullName: v })} />
          <Text style={styles.label}>Cep telefonu</Text>
          <TextInput
            style={styles.input}
            value={t.phone}
            onChangeText={(v) => setT({ ...t, phone: v })}
            keyboardType="phone-pad"
            placeholder="05XX XXX XX XX"
            placeholderTextColor={colors.inkFaint}
          />
          <Text style={styles.label}>Rol</Text>
          <View style={styles.chips}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.chip, t.role === r.key && styles.chipOn]}
                onPress={() => setT({ ...t, role: r.key })}
              >
                <Text style={[styles.chipText, t.role === r.key && styles.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {t.role === 'branch_manager' && branches.length > 1 && (
            <>
              <Text style={styles.label}>Şube kapsamı (seçilmezse tüm şubeler)</Text>
              <View style={styles.chips}>
                {branches.map((b) => {
                  const on = scope.includes(b.id);
                  return (
                    <TouchableOpacity
                      key={b.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setScope(on ? scope.filter((x) => x !== b.id) : [...scope, b.id])}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
          {!isNew && (
            <>
              <Text style={styles.label}>Durum</Text>
              <View style={styles.chips}>
                {(['active', 'suspended'] as const).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, t.status === s && styles.chipOn]}
                    onPress={() => setT({ ...t, status: s })}
                  >
                    <Text style={[styles.chipText, t.status === s && styles.chipTextOn]}>
                      {s === 'active' ? 'Aktif' : 'Askıda'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={[styles.save, (!valid || busy) && styles.disabled]} disabled={!valid || busy} onPress={save}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
          </TouchableOpacity>
          {!isNew && (
            <TouchableOpacity disabled={busy} onPress={() => del.mutate({ membershipId: t.membershipId! }, done)}>
              <Text style={[styles.link, { color: colors.danger, textAlign: 'center' }]}>Üyeyi firmadan çıkar</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.cancel}>Vazgeç</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BranchModal({
  orgId,
  target,
  onClose,
  onSaved,
}: {
  orgId: string;
  target: BranchTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [t, setT] = useState<BranchTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setT(target);
    setError(null);
  }, [target]);
  const create = trpc.customer.createBranch.useMutation();
  const upd = trpc.customer.updateBranch.useMutation();
  const busy = create.isPending || upd.isPending;
  if (!t) return <Modal visible={false} />;
  const nn = (v: string): string | null => (v.trim() ? v.trim() : null);
  const done = { onSuccess: onSaved, onError: (e: unknown) => setError(errText(e, 'Kaydedilemedi.')) };
  const save = (): void => {
    setError(null);
    if (t.id) upd.mutate({ id: t.id, name: t.name.trim(), address: nn(t.address), phone: nn(t.phone) }, done);
    else create.mutate({ orgId, name: t.name.trim(), address: nn(t.address), phone: nn(t.phone) }, done);
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <Text style={styles.h2}>{t.id ? 'Şubeyi düzenle' : 'Yeni şube'}</Text>
          <Text style={styles.label}>Şube adı</Text>
          <TextInput style={styles.input} value={t.name} onChangeText={(v) => setT({ ...t, name: v })} />
          <Text style={styles.label}>Adres</Text>
          <TextInput style={styles.input} value={t.address} onChangeText={(v) => setT({ ...t, address: v })} />
          <Text style={styles.label}>Telefon</Text>
          <TextInput style={styles.input} value={t.phone} onChangeText={(v) => setT({ ...t, phone: v })} keyboardType="phone-pad" />
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity
            style={[styles.save, (t.name.trim().length < 1 || busy) && styles.disabled]}
            disabled={t.name.trim().length < 1 || busy}
            onPress={save}
          >
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Kaydet</Text>}
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
  flex: { flex: 1 },
  content: { padding: spacing(5), gap: spacing(2), paddingBottom: spacing(10), backgroundColor: colors.bg },
  empty: { textAlign: 'center', marginTop: 40, color: colors.inkMuted },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  h1: { fontSize: 22, fontWeight: '800', color: colors.ink, flexShrink: 1 },
  h2: { fontSize: 17, fontWeight: '800', color: colors.ink },
  badge: { backgroundColor: colors.dangerSoft, color: colors.danger, fontSize: 11, fontWeight: '700', paddingHorizontal: spacing(2.5), paddingVertical: spacing(1), borderRadius: radius.pill, overflow: 'hidden' },
  section: { fontSize: 15, fontWeight: '800', color: colors.ink, marginTop: spacing(4) },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 12, color: colors.inkMuted, fontWeight: '600', marginTop: spacing(1) },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 15, color: colors.ink },
  msg: { color: colors.accent, fontSize: 13 },
  error: { color: colors.danger, fontSize: 13 },
  save: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center', marginTop: spacing(2) },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
  link: { color: colors.accent, fontWeight: '700', fontSize: 13, textAlign: 'center', marginTop: spacing(1) },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.md, padding: spacing(3.5), ...shadow.card },
  rowTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  rowMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  chev: { fontSize: 22, color: colors.inkFaint },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: spacing(5) },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(5), gap: spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2) },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: spacing(3), paddingVertical: spacing(2) },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  chipText: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  chipTextOn: { color: colors.accent },
  cancel: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, marginTop: spacing(1) },
});
