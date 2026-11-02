import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';
import { TICKET_STATUSES, TICKET_STATUS_COLOR, ticketStatusLabel } from './ticket-ui';

/** Talep konuşması. Personel: dahili not + durum değiştirme. */
export function TicketDetailScreen({ ticketRef, staff }: { ticketRef: string; staff: boolean }) {
  const utils = trpc.useUtils();
  const [text, setText] = useState('');
  const [internal, setInternal] = useState(false);

  const q = trpc.ticket.get.useQuery({ ticket: ticketRef });
  const refresh = (): void => {
    void utils.ticket.get.invalidate({ ticket: ticketRef });
    void utils.ticket.list.invalidate();
  };
  const reply = trpc.ticket.reply.useMutation({
    onSuccess: () => {
      setText('');
      setInternal(false);
      refresh();
    },
    onError: (e) => Alert.alert('Gönderilemedi', e.message),
  });
  const setStatus = trpc.ticket.setStatus.useMutation({
    onSuccess: refresh,
    onError: (e) => Alert.alert('Durum değişmedi', e.message),
  });

  if (q.isLoading) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />;
  if (!q.data) return <Text style={styles.empty}>Talep bulunamadı.</Text>;
  const t = q.data;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.subject}>{t.subject}</Text>
          <Text style={styles.meta}>
            {t.keyCode}
            {staff ? ` · ${t.orgName}` : ''}
            {t.orderKeyCode ? ` · Sipariş ${t.orderKeyCode}` : ''}
          </Text>
          <Text style={[styles.status, { color: TICKET_STATUS_COLOR[t.status] }]}>
            {ticketStatusLabel(t.status, staff)}
          </Text>
        </View>

        {staff && (
          <View style={styles.statusRow}>
            {TICKET_STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                disabled={setStatus.isPending || s === t.status}
                style={[styles.chip, s === t.status && styles.chipActive]}
                onPress={() => setStatus.mutate({ ticket: t.id, status: s })}
              >
                <Text style={[styles.chipText, s === t.status && styles.chipTextActive]}>
                  {ticketStatusLabel(s, true)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {t.messages.map((m) => {
          const mine = staff ? m.fromStaff : !m.fromStaff;
          return (
            <View
              key={m.id}
              style={[
                styles.bubble,
                mine ? styles.bubbleMine : styles.bubbleOther,
                m.internal && styles.bubbleInternal,
              ]}
            >
              <Text style={styles.author}>
                {m.internal ? 'Dahili not · ' : ''}
                {m.authorName}
                {m.fromStaff ? ' (RoasteryClub)' : ''}
              </Text>
              <Text style={styles.msg}>{m.body}</Text>
              <Text style={styles.time}>{new Date(m.createdAt).toLocaleString('tr-TR')}</Text>
            </View>
          );
        })}
      </ScrollView>

      {t.status === 'closed' ? (
        <Text style={styles.closed}>Bu talep kapatıldı.</Text>
      ) : (
        <View style={styles.composer}>
          {staff && (
            <View style={styles.internalRow}>
              <Switch value={internal} onValueChange={setInternal} />
              <Text style={styles.internalText}>Dahili not (müşteri görmez)</Text>
            </View>
          )}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="Yanıtınız…"
              placeholderTextColor={colors.inkFaint}
              multiline
              maxLength={4000}
            />
            <TouchableOpacity
              style={[styles.send, (!text.trim() || reply.isPending) && styles.disabled]}
              disabled={!text.trim() || reply.isPending}
              onPress={() =>
                reply.mutate({ ticket: t.id, body: text.trim(), internal: staff ? internal : undefined })
              }
            >
              {reply.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendText}>Gönder</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing(5), gap: spacing(2.5) },
  empty: { textAlign: 'center', color: colors.inkMuted, marginTop: spacing(6) },
  header: { gap: spacing(0.5), marginBottom: spacing(1) },
  subject: { fontSize: 18, fontWeight: '700', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkMuted },
  status: { fontSize: 12, fontWeight: '700' },
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5) },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing(2.5),
    paddingVertical: spacing(1.25),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 11, color: colors.ink, fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  bubble: { borderRadius: radius.md, padding: spacing(3), gap: spacing(1), maxWidth: '88%' },
  bubbleMine: { backgroundColor: colors.accentSoft, alignSelf: 'flex-end' },
  bubbleOther: {
    backgroundColor: colors.surface,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleInternal: { backgroundColor: '#fff7dc', borderColor: '#e6c55a', borderWidth: 1 },
  author: { fontSize: 11, fontWeight: '700', color: colors.inkMuted },
  msg: { fontSize: 14, color: colors.ink },
  time: { fontSize: 10, color: colors.inkFaint },
  closed: { textAlign: 'center', color: colors.inkMuted, padding: spacing(4) },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing(3),
    gap: spacing(2),
  },
  internalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2) },
  internalText: { fontSize: 12, color: colors.inkMuted },
  inputRow: { flexDirection: 'row', gap: spacing(2), alignItems: 'flex-end' },
  input: {
    flex: 1,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
    fontSize: 15,
    color: colors.ink,
  },
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(3),
  },
  disabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '700' },
});
