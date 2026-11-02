import { isProducerRole } from '@rc/shared';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/providers/auth-context';
import { trpc } from '@/lib/trpc';

// Uygulama açıkken de bildirim banner'ı göster.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Genel',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted && current.canAskAgain) {
    granted = (await Notifications.requestPermissionsAsync()).granted;
  }
  if (!granted) return null;

  const projectId = (Constants.expoConfig?.extra?.['eas'] as { projectId?: string } | undefined)
    ?.projectId;
  if (!projectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}

/**
 * Oturum açıldığında push iznini ister, Expo jetonunu sunucuya kaydeder ve
 * bildirime dokunulunca ilgili sipariş/talep ekranına gider. Ekran çizmez.
 */
export function PushBootstrap(): null {
  const { status, identity } = useAuth();
  const router = useRouter();
  const register = trpc.notification.registerDevice.useMutation();
  const registeredFor = useRef<string | null>(null);

  const active = status === 'authenticated' && identity != null && !identity.pending;
  const userId = identity?.id ?? null;
  const producer = identity?.roles.some(isProducerRole) ?? false;

  useEffect(() => {
    if (!active || !userId || registeredFor.current === userId) return;
    registeredFor.current = userId;
    void (async () => {
      try {
        const token = await getExpoPushToken();
        if (token) {
          register.mutate({
            token,
            platform: Platform.OS === 'ios' ? 'ios' : 'android',
          });
        }
      } catch {
        // Push opsiyonel — izin/ağ hatası uygulamayı etkilemesin.
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, userId]);

  useEffect(() => {
    if (!active) return;
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as Record<string, string | undefined>;
      const base = producer ? '/producer' : '/customer';
      if (data['orderId']) {
        router.push(`${base}/${producer ? 'siparisler' : 'siparislerim'}/${data['orderId']}` as Href);
      } else if (data['ticketId']) {
        router.push(`${base}/destek/${data['ticketId']}` as Href);
      } else {
        router.push(`${base}/bildirimler` as Href);
      }
    });
    return () => sub.remove();
  }, [active, producer, router]);

  return null;
}
