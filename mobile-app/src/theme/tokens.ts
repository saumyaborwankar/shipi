import { Platform } from 'react-native';

// Mirrors native-app/DESIGN.md — Notion's warm, paper-calm design language.
// Refined toward a "quiet secure-desk / vault": a warm paper canvas, one
// confident blue, and near-black ink, with elevation carried by layered
// barely-there shadows instead of heavy drop-shadows.
export const colors = {
  primary: '#0075de',
  primaryActive: '#005bab',
  primarySoft: '#e8f3fe',
  secondary: '#213183',
  onPrimary: '#ffffff',
  canvas: '#ffffff',
  canvasSoft: '#f6f5f4',
  surface: '#ffffff',
  surfaceMuted: '#fbfbfa',
  ink: '#1a1917',
  inkSecondary: '#2f2e2b',
  inkMuted: '#5f5b56',
  inkFaint: '#9b968e',
  hairline: '#e6e4e0',
  hairlineStrong: '#d3d1cb',
  focus: '#4d9df0',
  selection: 'rgba(0, 117, 222, 0.12)',
  overlay: 'rgba(26, 25, 23, 0.42)',
  skeleton: '#e7e5e1',
  success: '#2ea043',
  successSoft: '#e8f5ec',
  danger: '#d83a2e',
  dangerSoft: '#fbeceb',
  warning: '#b7711c',
  warningSoft: '#faf1e3',
  accentSky: '#62aef0',
  accentPurple: '#d6b6f6',
  accentPurpleDeep: '#391c57',
  accentPink: '#ff64c8',
  accentOrange: '#dd5b00',
  accentOrangeDeep: '#793400',
  accentTeal: '#2a9d99',
  accentGreen: '#1aae39',
  accentBrown: '#523410',
} as const;

export type ColorToken = keyof typeof colors;

export const radius = {
  xs: 4,
  sm: 5,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 28,
  xxl: 32,
} as const;

/** Minimum interactive hit area, per platform guidance. */
export const hitSlop = {
  small: { top: 4, left: 4, right: 4, bottom: 4 },
  medium: { top: 8, left: 8, right: 8, bottom: 8 },
} as const;

export type FontWeight = '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';

export interface TypeStyle {
  fontSize: number;
  fontWeight: FontWeight;
  lineHeight: number;
  letterSpacing: number;
}

export const typography = {
  display1: { fontSize: 64, fontWeight: '700', lineHeight: 64, letterSpacing: -2.125 },
  display2: { fontSize: 54, fontWeight: '700', lineHeight: 56, letterSpacing: -1.875 },
  heading1: { fontSize: 40, fontWeight: '700', lineHeight: 44, letterSpacing: -1 },
  heading2: { fontSize: 26, fontWeight: '700', lineHeight: 32, letterSpacing: -0.625 },
  heading3: { fontSize: 22, fontWeight: '700', lineHeight: 28, letterSpacing: -0.25 },
  title: { fontSize: 20, fontWeight: '600', lineHeight: 28, letterSpacing: -0.125 },
  bodyMd: { fontSize: 16, fontWeight: '400', lineHeight: 24, letterSpacing: 0 },
  bodySm: { fontSize: 15, fontWeight: '400', lineHeight: 20, letterSpacing: 0 },
  button: { fontSize: 16, fontWeight: '500', lineHeight: 24, letterSpacing: 0 },
  caption: { fontSize: 14, fontWeight: '400', lineHeight: 20, letterSpacing: 0 },
  eyebrow: { fontSize: 12, fontWeight: '600', lineHeight: 16, letterSpacing: 0.125 },
} as const satisfies Record<string, TypeStyle>;

export type TypographyToken = keyof typeof typography;

export const fonts = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }),
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    web: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    default: 'monospace',
  }),
} as const;

// Notion's elevation is "barely-there": hairline + faint layered shadows.
// To keep RN shallow, each level layers a tighter soft shadow under a wider
// translucent one, approximating the multi-stop stack without heavy cast.
export const shadows = {
  soft: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 7,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  hairline: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
} as const;

export interface MotionSpec {
  duration: number;
  easing: 'linear' | 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'keyboard';
}

/** Motion tokens — short for product/Operate surfaces. */
export const motion = {
  fast: 150,
  standard: 220,
  expressive: 360,
  staggered: 48,
} as const;
