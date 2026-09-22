import { BRAND, NEUTRAL, SEMANTIC } from '@rc/shared';

/**
 * Uygulama genelinde paylaşılan renk/aralık sabitleri — @rc/shared'daki marka
 * paletinden türetilir (tek gerçek kaynak), apps/admin ile aynı marka yeşili.
 * Yerleşim/bileşen dili (kart, sekme, yarıçap) mobile'a özgü kalır.
 */
export const colors = {
  bg: NEUTRAL[50],
  surface: NEUTRAL[0],
  surfaceMuted: NEUTRAL[100],
  border: NEUTRAL[200],
  ink: NEUTRAL[900],
  inkMuted: NEUTRAL[500],
  inkFaint: NEUTRAL[400],
  accent: BRAND[500],
  accentSoft: BRAND[50],
  danger: SEMANTIC.danger,
  dangerSoft: '#F8E9E9',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const spacing = (n: number): number => n * 4;
