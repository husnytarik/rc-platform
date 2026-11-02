import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Bu süre geçince kullanıcıya sunucunun uyanıyor olabileceği söylenir. */
const SLOW_AFTER_MS = 8_000;

/**
 * Oturum yüklenirken tam ekran bekleme. Ücretsiz barındırmada API boşta
 * uyuyabilir (ilk istek ~30–60 sn); spinner tek başına takılmış gibi durur,
 * bu yüzden gecikince açıklama + "Tekrar dene" gösterilir.
 */
export function StartupLoading() {
  const utils = trpc.useUtils();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.accent} size="large" />
      {slow && (
        <>
          <Text style={styles.text}>
            Sunucu uyanıyor, bu birkaç on saniye sürebilir. Lütfen bekle.
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => void utils.auth.me.refetch()}>
            <Text style={styles.buttonText}>Tekrar dene</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(6),
    gap: spacing(3),
    backgroundColor: colors.bg,
  },
  text: { color: colors.inkMuted, fontSize: 14, textAlign: 'center' },
  button: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  buttonText: { color: colors.ink, fontWeight: '600' },
});
