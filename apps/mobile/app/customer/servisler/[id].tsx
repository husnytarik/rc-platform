import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function ServisTalepFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const utils = trpc.useUtils();
  const services = trpc.service.listActive.useQuery();
  const service = services.data?.find((s) => s.id === id);

  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const create = trpc.service.createRequest.useMutation({
    onSuccess: () => {
      setDone(true);
      void utils.service.listRequests.invalidate();
    },
    onError: (e) => setError(errText(e, 'Talep oluşturulamadı.')),
  });

  if (services.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.centered}>
        <Text style={styles.empty}>Servis bulunamadı.</Text>
      </View>
    );
  }

  if (done) {
    return (
      <View style={styles.centered}>
        <Text style={styles.doneTitle}>Talebiniz alındı</Text>
        <Text style={styles.doneText}>Ekibimiz en kısa sürede sizinle iletişime geçecek.</Text>
        <TouchableOpacity style={styles.submitButton} onPress={() => router.back()}>
          <Text style={styles.submitButtonText}>Servislere dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{service.name}</Text>
      {service.description && <Text style={styles.description}>{service.description}</Text>}
      {service.basePrice != null && (
        <Text style={styles.price}>{service.basePrice.toFixed(2)} ₺&apos;den başlayan</Text>
      )}

      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>İhtiyacınızı kısaca anlatın</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={note}
          onChangeText={setNote}
          placeholder="Ne zaman, nerede, ne için ihtiyacınız var? (opsiyonel)"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, create.isPending && styles.submitButtonDisabled]}
        disabled={create.isPending}
        onPress={() => {
          setError(null);
          create.mutate({ serviceId: service.id, note: note.trim() || undefined });
        }}
      >
        {create.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Talep oluştur</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4) },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: spacing(5), gap: spacing(3) },
  title: { fontSize: 19, fontWeight: '700', color: colors.ink },
  description: { fontSize: 14, color: colors.inkMuted, marginTop: spacing(-2) },
  price: { fontSize: 13, color: colors.inkMuted, fontWeight: '600', marginTop: spacing(-2) },
  errorBox: { backgroundColor: colors.dangerSoft, borderRadius: radius.sm, padding: spacing(3) },
  errorText: { color: colors.danger, fontSize: 13 },
  field: { gap: spacing(1.5) },
  label: { fontSize: 13, color: colors.inkMuted, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    color: colors.ink,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.border },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { fontSize: 13, color: colors.inkMuted },
  doneTitle: { fontSize: 18, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  doneText: { fontSize: 14, color: colors.inkMuted, textAlign: 'center' },
});
