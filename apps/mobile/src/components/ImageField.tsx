import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { apiBaseUrl, trpc } from '@/lib/trpc';
import { colors, radius, spacing } from '@/theme';

/** Ürün görseli: telefonla çek / galeriden seç (küçültülüp yüklenir) ya da URL yapıştır. */
export function ImageField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const upload = trpc.catalog.uploadImage.useMutation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library'): Promise<void> => {
    setError(null);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setError('İzin verilmedi. Ayarlar’dan kamera/fotoğraf iznini açın.');
        return;
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      };
      const res =
        source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const small = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 1000 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true },
      );
      if (!small.base64) throw new Error('Görsel işlenemedi.');
      const { path } = await upload.mutateAsync({ base64: small.base64 });
      onChange(`${apiBaseUrl()}${path}`);
    } catch (e) {
      const m = (e as { message?: string }).message;
      setError(m && m.length < 160 ? m : 'Görsel yüklenemedi.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {value.trim().startsWith('http') && (
        <Image source={{ uri: value.trim() }} style={styles.preview} resizeMode="cover" />
      )}
      <View style={styles.row}>
        <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => void pick('camera')}>
          <Icon name="camera-outline" size={18} color={colors.accent} />
          <Text style={styles.btnText}>Fotoğraf çek</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btn} disabled={busy} onPress={() => void pick('library')}>
          <Icon name="images-outline" size={18} color={colors.accent} />
          <Text style={styles.btnText}>Galeriden seç</Text>
        </TouchableOpacity>
      </View>
      {busy && <ActivityIndicator color={colors.accent} />}
      {error && <Text style={styles.error}>{error}</Text>}
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        keyboardType="url"
        placeholder="veya görsel URL’si (https://…)"
        placeholderTextColor={colors.inkFaint}
      />
      {value.trim() !== '' && (
        <TouchableOpacity onPress={() => onChange('')}>
          <Text style={styles.remove}>Görseli kaldır</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing(2) },
  preview: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  row: { flexDirection: 'row', gap: spacing(2) },
  btn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing(1.5), backgroundColor: colors.accentSoft, borderRadius: radius.sm, paddingVertical: spacing(3) },
  btnText: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: spacing(3), paddingVertical: spacing(2.5), fontSize: 14, color: colors.ink },
  error: { color: colors.danger, fontSize: 12 },
  remove: { color: colors.danger, fontWeight: '700', fontSize: 12, textAlign: 'center' },
});
