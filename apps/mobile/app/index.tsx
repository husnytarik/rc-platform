import { isProducerRole, ROLE_LABELS_TR, type Role } from '@rc/shared';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

function displayName(identity: { fullName: string | null; phone: string | null }): string {
  return identity.fullName ?? identity.phone ?? 'Kullanıcı';
}

function RegistrationForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [phone, setPhone] = useState('');
  const [orgName, setOrgName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = trpc.auth.submitMembershipRequest.useMutation();
  const canSubmit = phone.trim().length >= 7 && orgName.trim().length >= 2 && !submit.isPending;

  const send = (): void => {
    setError(null);
    submit.mutate(
      {
        phone: phone.trim(),
        orgName: orgName.trim(),
        taxId: taxId.trim() || undefined,
        address: address.trim() || undefined,
        note: note.trim() || undefined,
      },
      {
        onSuccess: onSubmitted,
        onError: (e: unknown) => setError(errText(e, 'Başvuru gönderilemedi. Tekrar dener misin?')),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.formTitle}>Firma bilgilerini paylaş</Text>
        <Text style={styles.formSubtitle}>
          Ekibimiz belirttiğin telefon numarasından seni arayıp başvurunu doğrulayacak.
        </Text>

        <View style={styles.formFields}>
          <View style={styles.field}>
            <Text style={styles.label}>Telefon *</Text>
            <TextInput
              style={styles.input}
              placeholder="+90 5xx xxx xx xx"
              placeholderTextColor={colors.inkFaint}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Firma adı *</Text>
            <TextInput
              style={styles.input}
              placeholder="Örn. Kadıköy Kahve Evi"
              placeholderTextColor={colors.inkFaint}
              value={orgName}
              onChangeText={setOrgName}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Vergi no</Text>
            <TextInput
              style={styles.input}
              placeholder="İsteğe bağlı"
              placeholderTextColor={colors.inkFaint}
              keyboardType="number-pad"
              value={taxId}
              onChangeText={setTaxId}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Adres</Text>
            <TextInput
              style={styles.input}
              placeholder="İsteğe bağlı"
              placeholderTextColor={colors.inkFaint}
              value={address}
              onChangeText={setAddress}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Not</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              placeholder="Eklemek istediğin bir şey var mı?"
              placeholderTextColor={colors.inkFaint}
              value={note}
              onChangeText={setNote}
              multiline
            />
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
          disabled={!canSubmit}
          onPress={send}
        >
          {submit.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Başvuruyu gönder</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default function HomeScreen() {
  const { status, identity, logout } = useAuth();
  const utils = trpc.useUtils();
  // Hook sayısı render'lar arası sabit kalmalı — erken return'lerden önce çağır,
  // gerçek veri yalnız aktif/onaylı kullanıcıda gerekiyor (enabled ile geciktir).
  const ready = status === 'authenticated' && identity !== null && !identity.pending;
  const categories = trpc.catalog.categories.useQuery(undefined, { enabled: ready });
  const products = trpc.catalog.list.useQuery({ limit: 10 }, { enabled: ready });

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }
  if (status === 'anonymous' || !identity) return <Redirect href="/login" />;

  if (identity.pending && !identity.hasPendingRequest) {
    return (
      <View style={styles.flex}>
        <View style={styles.pendingHeader}>
          <Text style={styles.greeting}>Merhaba, {displayName(identity)}</Text>
          <TouchableOpacity onPress={logout}>
            <Text style={styles.logoutLink}>Çıkış</Text>
          </TouchableOpacity>
        </View>
        <RegistrationForm onSubmitted={() => void utils.auth.me.invalidate()} />
      </View>
    );
  }

  if (identity.pending) {
    return (
      <View style={styles.center}>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingBadgeText}>Onay bekliyor</Text>
        </View>
        <Text style={styles.title}>Merhaba, {displayName(identity)}</Text>
        <Text style={styles.pending}>
          Başvurun inceleniyor. Ekibimiz seni telefonla arayıp doğruladıktan sonra bu ekrandan
          katalog ve siparişlerine erişebileceksin.
        </Text>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Çıkış yap</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const producer = identity.roles.some((r) => isProducerRole(r));
  const roleLabels = identity.roles.map((r) => ROLE_LABELS_TR[r as Role]).join(', ');

  return (
    <View style={styles.flex}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Merhaba, {displayName(identity)}</Text>
          <Text style={styles.role}>{roleLabels}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logoutLink}>Çıkış</Text>
        </TouchableOpacity>
      </View>

      {producer && categories.data && (
        <Text style={styles.sectionNote}>
          {categories.data.length} kategori · üretici görünümü (gerçek stok görünür)
        </Text>
      )}

      <FlatList
        style={styles.flex}
        contentContainerStyle={styles.listContent}
        data={products.data?.items ?? []}
        keyExtractor={(p) => p.id}
        refreshing={products.isFetching}
        onRefresh={() => void products.refetch()}
        ListEmptyComponent={
          products.isLoading ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={colors.accent} />
          ) : (
            <Text style={styles.empty}>Katalogda ürün yok.</Text>
          )
        }
        renderItem={({ item }) => {
          const price = item.variants[0]?.price;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardMeta}>{item.categoryName ?? '—'}</Text>
              <Text style={styles.cardPrice}>
                {price ? `${price.unitPrice} ${price.currency}` : 'Fiyat yok'}
              </Text>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(3),
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(15),
    paddingBottom: spacing(4),
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing(5),
    paddingTop: spacing(15),
    paddingBottom: spacing(2),
  },
  greeting: { fontSize: 18, fontWeight: '700', color: colors.ink },
  role: { fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  logoutLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  logoutButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3),
    paddingHorizontal: spacing(6),
  },
  logoutButtonText: { color: '#fff', fontWeight: '600' },
  pendingBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(1.5),
  },
  pendingBadgeText: { color: colors.accent, fontWeight: '700', fontSize: 12 },
  title: { fontSize: 20, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  pending: { fontSize: 15, color: colors.inkMuted, textAlign: 'center', lineHeight: 22 },
  sectionNote: { paddingHorizontal: spacing(5), color: colors.inkMuted, fontSize: 12, marginBottom: spacing(2) },
  listContent: { paddingHorizontal: spacing(5), paddingBottom: spacing(8), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(3.5),
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.ink },
  cardMeta: { fontSize: 12, color: colors.inkMuted, marginTop: 2 },
  cardPrice: { fontSize: 14, color: colors.accent, fontWeight: '700', marginTop: spacing(1.5) },
  formScroll: { padding: spacing(5), gap: spacing(4) },
  formTitle: { fontSize: 20, fontWeight: '700', color: colors.ink },
  formSubtitle: { fontSize: 13, color: colors.inkMuted, lineHeight: 19 },
  formFields: { gap: spacing(3.5) },
  field: { gap: spacing(1.5) },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3.5),
    paddingVertical: spacing(3),
    fontSize: 15,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  inputMultiline: { minHeight: 80, textAlignVertical: 'top' },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: {
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    padding: spacing(3),
    fontSize: 13,
    textAlign: 'center',
  },
});
