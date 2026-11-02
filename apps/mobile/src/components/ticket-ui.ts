import { colors } from '@/theme';

export type TicketStatusKey = 'open' | 'pending_staff' | 'pending_customer' | 'resolved' | 'closed';

export const TICKET_STATUSES: TicketStatusKey[] = [
  'open',
  'pending_staff',
  'pending_customer',
  'resolved',
  'closed',
];

export function ticketStatusLabel(status: TicketStatusKey, staff: boolean): string {
  switch (status) {
    case 'open':
      return 'Açık';
    case 'pending_staff':
      return staff ? 'Yanıt bekliyor' : 'İnceleniyor';
    case 'pending_customer':
      return staff ? 'Müşteri yanıtı bekleniyor' : 'Sizden yanıt bekleniyor';
    case 'resolved':
      return 'Çözüldü';
    case 'closed':
      return 'Kapatıldı';
  }
}

export const TICKET_STATUS_COLOR: Record<TicketStatusKey, string> = {
  open: colors.accent,
  pending_staff: '#b8860b',
  pending_customer: colors.accent,
  resolved: '#3a7d5c',
  closed: colors.inkMuted,
};
