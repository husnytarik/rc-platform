import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Müşteri yeni destek talebi formu (isteğe bağlı sipariş kodu). */
export function TicketNewScreen({ basePath }: { basePath: string }) {
  const router = useRouter();
  const utils = trpc.useUtils();
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [orderRef, setOrderRef] = useState('');

  const create = trpc.ticket.create.useMutation({
    onSuccess: ({ id }) => {
      void utils.ticket.list.invalidate();
      router.replace(`${basePath}/${id}` as Href);
    },
    onError: (e) => Alert.alert('Talep açılamadı', e.message),
  });

  const valid = subject.trim().length >= 3 && body.trim().length >= 3;

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Konu</Text>
        <TextInput style={styles.input} value={subject} onChangeText={setSubject} maxLength={150} />
        <Text style={styles.label}>Sipariş kodu (isteğe bağlı)</Text>
        <TextInput
          style={styles.input}
          value={orderRef}
          onChangeText={setOrderRef}
          autoCapitalize="characters"
          placeholder="SIP-2026-000123"
          placeholderTextColor={colors.inkFaint}
        />
        <Text style={styles.label}>Mesajınız</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={4000}
        />
        <TouchableOpacity
          style={[styles.submit, (!valid || create.isPending) && styles.disabled]}
          disabled={!valid || create.isPending}
          onPress={() =>
            create.mutate({
              subject: subject.trim(),
              body: body.trim(),
              orderRef: orderRef.trim() || undefined,
            })
          }
        >
          {create.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Gönder</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2) },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, marginTop: spacing(1.5) },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 15,
    color: colors.ink,
  },
  multiline: { minHeight: 140, textAlignVertical: 'top' },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing(3.5),
    alignItems: 'center',
    marginTop: spacing(3),
  },
  disabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
