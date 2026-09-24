import { isProducerRole, ROLE_LABELS_TR, type Role } from '@rc/shared';
import { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/providers/auth-context';
import { useCart } from '@/providers/cart-context';
import { colors, radius, spacing } from '@/theme';

function displayName(identity: { fullName: string | null; phone: string | null }): string {
  return identity.fullName ?? identity.phone ?? 'Kullanıcı';
}

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function CompanyCard({ orgId }: { orgId: string }) {
  const utils = trpc.useUtils();
  const org = trpc.customer.get.useQuery({ id: orgId });
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = trpc.customer.update.useMutation({
    onSuccess: () => {
      setEditing(false);
      void utils.customer.get.invalidate({ id: orgId });
    },
    onError: (e) => setError(errText(e, 'Firma bilgileri güncellenemedi.')),
  });

  const startEdit = (): void => {
    if (!org.data) return;
    setName(org.data.name ?? '');
    setTaxId(org.data.taxId ?? '');
    setPhone(org.data.phone ?? '');
    setEmail(org.data.email ?? '');
    setAddress(org.data.address ?? '');
    setError(null);
    setEditing(true);
  };

  if (org.isLoading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  if (!org.data) return null;

  if (!editing) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitleSm}>Firma bilgileri</Text>
          <TouchableOpacity onPress={startEdit}>
            <Text style={styles.editLink}>Düzenle</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Firma adı</Text>
            <Text style={styles.rowValue}>{org.data.name || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Vergi no</Text>
            <Text style={styles.rowValue}>{org.data.taxId || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Telefon</Text>
            <Text style={styles.rowValue}>{org.data.phone || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>E-posta</Text>
            <Text style={styles.rowValue}>{org.data.email || '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Adres</Text>
            <Text style={styles.rowValue}>{org.data.address || '—'}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitleSm}>Firma bilgileri</Text>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      <View style={styles.field}>
        <Text style={styles.label}>Firma adı</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={colors.inkFaint} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Vergi no</Text>
        <TextInput
          style={styles.input}
          value={taxId}
          onChangeText={setTaxId}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Telefon</Text>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={setPhone}
          placeholderTextColor={colors.inkFaint}
          keyboardType="phone-pad"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>E-posta</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Adres</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={address}
          onChangeText={setAddress}
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </View>
      <View style={styles.editActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => setEditing(false)}
          disabled={update.isPending}
        >
          <Text style={styles.cancelButtonText}>Vazgeç</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, update.isPending && styles.saveButtonDisabled]}
          disabled={update.isPending}
          onPress={() => {
            setError(null);
            update.mutate({
              id: orgId,
              name: name.trim() || undefined,
              taxId: taxId.trim() || null,
              phone: phone.trim() || null,
              email: email.trim() || null,
              address: address.trim() || null,
            });
          }}
        >
          {update.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveButtonText}>Kaydet</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function AccountScreen() {
  const { identity, can, logout } = useAuth();
  const cart = useCart();
  if (!identity) return null;

  const onLogout = (): void => {
    cart.clear();
    logout();
  };

  const roleLabels = identity.roles.map((r) => ROLE_LABELS_TR[r as Role]).join(', ');
  const showCompanyCard = !identity.roles.some((r) => isProducerRole(r as Role)) && can('customer.manage');
  const orgId = showCompanyCard ? identity.memberships[0]?.orgId : undefined;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <Text style={styles.name}>{displayName(identity)}</Text>
        {roleLabels.length > 0 && <Text style={styles.role}>{roleLabels}</Text>}
        <View style={styles.rows}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Telefon</Text>
            <Text style={styles.rowValue}>{identity.phone ?? '—'}</Text>
          </View>
        </View>
      </View>

      {orgId && <CompanyCard orgId={orgId} />}

      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Çıkış yap</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleSm: { fontSize: 15, fontWeight: '700', color: colors.ink },
  editLink: { fontSize: 13, fontWeight: '700', color: colors.accent },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  role: { fontSize: 13, color: colors.inkMuted },
  rows: { marginTop: spacing(3), gap: spacing(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing(3) },
  rowLabel: { fontSize: 13, color: colors.inkMuted },
  rowValue: { fontSize: 13, color: colors.ink, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  field: { gap: spacing(1.5), marginTop: spacing(3) },
  label: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    color: colors.ink,
  },
  multiline: { minHeight: 70, textAlignVertical: 'top' },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3), marginTop: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  editActions: { flexDirection: 'row', gap: spacing(2.5), marginTop: spacing(4) },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(3),
    alignItems: 'center',
  },
  cancelButtonText: { color: colors.inkMuted, fontWeight: '700', fontSize: 14 },
  saveButton: { flex: 1, backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3), alignItems: 'center' },
  saveButtonDisabled: { backgroundColor: colors.border },
  saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  logoutButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.sm,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  logoutButtonText: { color: colors.danger, fontSize: 15, fontWeight: '700' },
});
