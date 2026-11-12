import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/**
 * Gönderilmemiş (taslak) sipariş, kullanıcı başına cihazda saklanır; uygulama kapansa da kaybolmaz.
 * Native'de dosya sistemi (SecureStore'un boyut sınırına takılmamak için), web'de localStorage.
 */
export interface DraftData {
  lines: unknown[];
  branchId: string | null;
  note: string;
}

const key = (userId: string): string => `rc-draft-${userId}`;
const path = (userId: string): string => `${FileSystem.documentDirectory ?? ''}${key(userId)}.json`;

export const draftStore = {
  async load(userId: string): Promise<DraftData | null> {
    try {
      const raw =
        Platform.OS === 'web'
          ? (globalThis.localStorage?.getItem(key(userId)) ?? null)
          : await FileSystem.readAsStringAsync(path(userId)).catch(() => null);
      return raw ? (JSON.parse(raw) as DraftData) : null;
    } catch {
      return null;
    }
  },
  async save(userId: string, data: DraftData): Promise<void> {
    try {
      const raw = JSON.stringify(data);
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(key(userId), raw);
      else await FileSystem.writeAsStringAsync(path(userId), raw);
    } catch {
      /* taslak kaydı en iyi çaba */
    }
  },
  async clear(userId: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key(userId));
      else await FileSystem.deleteAsync(path(userId), { idempotent: true });
    } catch {
      /* yok say */
    }
  },
};
