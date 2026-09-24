import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

function errText(e: unknown, fallback: string): string {
  const m = (e as { message?: string } | undefined)?.message;
  return m && m.length < 200 ? m : fallback;
}

export default function YeniServisScreen() {
  const router = useRouter();
  const utils = trpc.useUtils();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = trpc.service.create.useMutation({
    onSuccess: () => {
      void utils.service.adminList.invalidate();
      void utils.service.listActive.invalidate();
      router.back();
    },
    onError: (e) => setError(errText(e, 'Servis oluşturulamadı.')),
  });

  const canSubmit = code.trim().length > 0 && name.trim().length > 0;

  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.content}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={styles.label}>Servis kodu *</Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="ör. SRV-001"
          placeholderTextColor={colors.inkFaint}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Ad *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Servis adı"
          placeholderTextColor={colors.inkFaint}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Açıklama</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Açıklama (opsiyonel)"
          placeholderTextColor={colors.inkFaint}
          multiline
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Başlangıç fiyatı</Text>
        <TextInput
          style={styles.input}
          value={basePrice}
          onChangeText={setBasePrice}
          placeholder="Opsiyonel"
          placeholderTextColor={colors.inkFaint}
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity
        style={[styles.submitButton, (!canSubmit || create.isPending) && styles.submitButtonDisabled]}
        disabled={!canSubmit || create.isPending}
        onPress={() => {
          setError(null);
          const price = basePrice.trim() ? Number(basePrice.replace(',', '.')) : undefined;
          create.mutate({
            code: code.trim(),
            name: name.trim(),
            description: description.trim() || undefined,
            basePrice: price !== undefined && Number.isFinite(price) ? price : undefined,
          });
        }}
      >
        {create.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Servisi oluştur</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(4) },
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  submitButton: { backgroundColor: colors.accent, borderRadius: radius.sm, paddingVertical: spacing(3.5), alignItems: 'center' },
  submitButtonDisabled: { backgroundColor: colors.border },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
