import { ROLE_LABELS_TR, type Role } from '@rc/shared';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { colors, radius, spacing } from '@/theme';

function displayName(identity: { fullName: string | null; phone: string | null }): string {
  return identity.fullName ?? identity.phone ?? 'Kullanıcı';
}

export function AccountScreen() {
  const { identity, logout } = useAuth();
  if (!identity) return null;

  const roleLabels = identity.roles.map((r) => ROLE_LABELS_TR[r as Role]).join(', ');

  return (
    <View style={styles.flex}>
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

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Çıkış yap</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg, padding: spacing(5), gap: spacing(5) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing(5),
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing(1),
  },
  name: { fontSize: 18, fontWeight: '700', color: colors.ink },
  role: { fontSize: 13, color: colors.inkMuted },
  rows: { marginTop: spacing(3), gap: spacing(2) },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { fontSize: 13, color: colors.inkMuted },
  rowValue: { fontSize: 13, color: colors.ink, fontWeight: '600' },
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
