import type { OrderStatus } from './order-state';

/**
 * Tasarım tokenları — tek gerçek kaynak. Web (`apps/admin`) bunları CSS custom
 * property'ye, mobil (`apps/mobile`) doğrudan JS objesi olarak okur. Çerçeveye
 * bağımlı değil: yalnızca ham değerler (hex, px, ms).
 *
 * Marka rengi yeşil ve **şiddeti ayarlanabilir**: `BRAND` ölçeği tek kaynak,
 * `brandRamp(intensity)` ile doygunluk 0.7–1.4 arası çarpanla yeniden üretilir
 * (1 = tasarım referansı). Yeni bir ton isteniyorsa yalnızca burası değişir.
 */

export const BRAND = {
  50: '#eef7f0',
  100: '#d6ecdb',
  200: '#aed9b9',
  300: '#7cbf8f',
  400: '#4e9f68',
  500: '#2f7d49', // marka ana yeşili
  600: '#246139',
  700: '#1d4c2e',
  800: '#173c25',
  900: '#0f2818',
} as const;

/** Hafif yeşile çalan nötrler — saf gri "düşünülmemiş" görünür. */
export const NEUTRAL = {
  0: '#ffffff',
  50: '#f6f8f6',
  100: '#eef1ee',
  200: '#dfe4df',
  300: '#c4ccc4',
  400: '#9aa69a',
  500: '#6f7d6f',
  600: '#4f5b4f',
  700: '#3a453a',
  800: '#232b23',
  900: '#141813',
} as const;

/** Marka renginden bağımsız anlam ekseni: iyi / uyarı / kritik / bilgi. */
export const SEMANTIC = {
  success: '#2f7d49',
  warning: '#b8860b',
  danger: '#b23b3b',
  info: '#2f6fb0',
} as const;

export const SPACE = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

/** Yarıçap role göre — her şeye tek yarıçap değil. */
export const RADIUS = {
  none: 0,
  control: 6, // input, buton
  card: 10,
  pill: 999,
} as const;

export const FONT_SIZE = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  '2xl': 28,
} as const;

export const ELEVATION = {
  none: 'none',
  card: '0 1px 2px rgba(20, 24, 19, 0.06), 0 1px 8px rgba(20, 24, 19, 0.04)',
  panel: '0 8px 32px rgba(20, 24, 19, 0.16)',
} as const;

export const MOTION = {
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/**
 * Marka ölçeğini doygunluk çarpanıyla yeniden üretir. `intensity` 1 iken `BRAND`
 * aynen döner; >1 daha canlı, <1 daha soluk. HSL üzerinde yalnız doygunluğu
 * ölçekler, ton ve parlaklık sabit kalır.
 */
export function brandRamp(intensity = 1): Record<keyof typeof BRAND, string> {
  const k = Math.min(1.4, Math.max(0.7, intensity));
  const out = {} as Record<keyof typeof BRAND, string>;
  for (const [step, hex] of Object.entries(BRAND)) {
    const [h, s, l] = hexToHsl(hex);
    out[Number(step) as keyof typeof BRAND] = hslToHex(h, Math.min(100, s * k), l);
  }
  return out;
}

export type StatusTone = 'neutral' | 'info' | 'progress' | 'success' | 'danger' | 'warn' | 'hold';

interface StatusMeta {
  tone: StatusTone;
  /** Rozet metni + kenarı için ana renk. */
  color: string;
  /** lucide ikon adı — admin ve mobil aynı seti kullanır. */
  icon: string;
}

/** Sipariş durumu = renk + ikon. Marka yeşilinden ayrı, anlamsal. */
export const ORDER_STATUS_META: Record<OrderStatus, StatusMeta> = {
  placed: { tone: 'info', color: SEMANTIC.info, icon: 'inbox' },
  confirmed: { tone: 'progress', color: '#3a7d5c', icon: 'check-circle' },
  in_production: { tone: 'progress', color: '#7a6a1f', icon: 'factory' },
  production_done: { tone: 'progress', color: '#5f7a1f', icon: 'package-check' },
  ready_to_ship: { tone: 'progress', color: '#2f6fb0', icon: 'package' },
  in_transit: { tone: 'progress', color: '#2f5fb0', icon: 'truck' },
  delivered: { tone: 'success', color: SEMANTIC.success, icon: 'circle-check-big' },
  cancelled: { tone: 'danger', color: SEMANTIC.danger, icon: 'circle-x' },
  delivery_issue: { tone: 'warn', color: SEMANTIC.warning, icon: 'triangle-alert' },
  on_hold: { tone: 'hold', color: NEUTRAL[500], icon: 'pause' },
};

// --- renk yardımcıları (bağımlılıksız) ---

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const toHex = (v: number): string =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
