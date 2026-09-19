/** Uygulama genelinde paylaşılan renk/aralık sabitleri — kahve/rosterie kimliği. */
export const colors = {
  bg: '#FBF6F0',
  surface: '#FFFFFF',
  surfaceMuted: '#F5EBE0',
  border: '#EAE0D3',
  ink: '#241811',
  inkMuted: '#8A7A6C',
  inkFaint: '#B3A697',
  accent: '#C2410C',
  accentSoft: '#F6E4D6',
  danger: '#B91C1C',
  dangerSoft: '#FBEAE8',
} as const;

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 } as const;

export const spacing = (n: number): number => n * 4;
