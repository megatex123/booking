export type ThemeScheme = 'light' | 'dark';

const light = {
  primary:        '#1A73E8',
  primaryDark:    '#1557B0',
  secondary:      '#FF6B35',
  success:        '#34A853',
  warning:        '#FBBC04',
  danger:         '#EA4335',
  background:     '#F5F7FA',
  surface:        '#FFFFFF',
  text:           '#1A1A2E',
  textSecondary:  '#6B7280',
  textLight:      '#9CA3AF',
  border:         '#E5E7EB',
  divider:        '#F3F4F6',
  shadow:         'rgba(0,0,0,0.08)',
  overlay:        'rgba(0,0,0,0.5)',
};

const dark = {
  primary:        '#4A9EFF',
  primaryDark:    '#1A73E8',
  secondary:      '#FF8C5A',
  success:        '#4ADE80',
  warning:        '#FBBF24',
  danger:         '#F87171',
  background:     '#0F172A',
  surface:        '#1E293B',
  text:           '#F1F5F9',
  textSecondary:  '#94A3B8',
  textLight:      '#64748B',
  border:         '#334155',
  divider:        '#1E293B',
  shadow:         'rgba(0,0,0,0.3)',
  overlay:        'rgba(0,0,0,0.7)',
};

export const Themes = { light, dark };

export type AppTheme = typeof light;

export const Colors = light;

export const StatusColors: Record<string, string> = {
  pending:    '#FBBC04',
  confirmed:  '#1A73E8',
  in_progress:'#FF6B35',
  completed:  '#34A853',
  rejected:   '#EA4335',
  cancelled:  '#9CA3AF',
  unpaid:     '#EA4335',
  paid:       '#34A853',
};

export const Typography = {
  h1:        { fontSize: 28, fontWeight: '700' as const },
  h2:        { fontSize: 22, fontWeight: '700' as const },
  h3:        { fontSize: 18, fontWeight: '600' as const },
  body:      { fontSize: 15, fontWeight: '400' as const },
  bodySmall: { fontSize: 13, fontWeight: '400' as const },
  caption:   { fontSize: 11, fontWeight: '400' as const },
  button:    { fontSize: 16, fontWeight: '600' as const },
};

export const Spacing = {
  xs:  4,
  sm:  8,
  md:  16,
  lg:  24,
  xl:  32,
  xxl: 48,
};

export const BorderRadius = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  full: 999,
};
