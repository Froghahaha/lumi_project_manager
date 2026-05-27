// ─── Design tokens — single source of truth for visual constants ─────────
// Consumed by components, format.ts, and PhaseProgress.

// ── Palette ─────────────────────────────────────────────────

export const COLOR = {
  /** Ant Design 5 primary blue */
  primary: '#1677ff',
  /** Success green */
  success: '#52c41a',
  /** Warning gold */
  warning: '#faad14',
  /** Warning orange (alert-level) */
  warningOrange: '#fa8c16',
  /** Error / danger red */
  error: '#ff4d4f',
  /** Darker error text (for emphasis on dark backgrounds) */
  errorText: '#cf1322',
  /** Neutral gray — disabled, placeholder */
  disabled: '#d9d9d9',
  /** Layout background */
  bgLayout: '#fafafa',
  /** Border / divider */
  border: '#f0f0f0',
  /** Secondary text on medium backgrounds */
  textSecondary: '#666',

  // ── Header dark theme ──
  headerGradientStart: '#001529',
  headerGradientEnd: '#003a70',
  headerText: '#ffffff',
  headerTextDim: 'rgba(255,255,255,0.65)',
} as const

// ── Typography ──────────────────────────────────────────────

export const FONT = {
  /** Secondary label */
  label: 12,
  /** Strong value */
  value: 13,
  /** Body */
  body: 14,
  /** Small note */
  note: 11,
} as const

// ── Spacing ─────────────────────────────────────────────────

export const SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 32,
} as const

// ── Radius ──────────────────────────────────────────────────

export const RADIUS = {
  sm: 6,
  md: 8,
} as const
