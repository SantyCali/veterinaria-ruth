// Colores y tipografía tomados del diseño de Stitch ("Veterinaria Ruth Web App").

export const colors = {
  primary: '#00685f',
  primaryStrong: '#0d9488',
  primarySoft: '#e0f5f1',
  primaryText: '#ffffff',

  accent: '#b90538',
  accentSoft: '#ffe4e8',

  background: '#f8f9ff',
  surface: '#ffffff',
  surfaceAlt: '#eff4ff',
  surfaceMuted: '#e5eeff',

  text: '#0b1c30',
  textMuted: '#3d4947',
  textSubtle: '#64748b',

  border: '#dbe3f0',
  borderStrong: '#bcc9c6',

  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  danger: '#b91c1c',
  dangerSoft: '#fee2e2',
  neutral: '#475569',
  neutralSoft: '#e2e8f0',
  info: '#0369a1',
  infoSoft: '#e0f2fe',
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Ancho a partir del cual se usa el menú lateral (PC) en vez de la barra inferior (celu). */
export const WIDE_BREAKPOINT = 900;
