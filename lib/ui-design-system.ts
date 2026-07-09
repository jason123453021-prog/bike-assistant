/**
 * UI/UX 設計系統和組件庫
 */

/**
 * 設計令牌
 */
export const designTokens = {
  colors: {
    primary: '#0a7ea4',
    secondary: '#ff6b6b',
    success: '#51cf66',
    warning: '#ffd43b',
    error: '#ff6b6b',
    background: '#ffffff',
    surface: '#f5f5f5',
    foreground: '#11181c',
    muted: '#687076',
    border: '#e5e7eb',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700', lineHeight: 1.2 },
    h2: { fontSize: 28, fontWeight: '700', lineHeight: 1.3 },
    h3: { fontSize: 24, fontWeight: '600', lineHeight: 1.4 },
    body: { fontSize: 16, fontWeight: '400', lineHeight: 1.5 },
    caption: { fontSize: 12, fontWeight: '400', lineHeight: 1.4 },
  },
  borderRadius: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
  shadows: {
    sm: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
    md: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 6 },
    lg: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12 },
  },
  animations: {
    duration: {
      fast: 150,
      normal: 300,
      slow: 500,
    },
    easing: {
      ease: 'ease',
      easeIn: 'ease-in',
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
    },
  },
};

/**
 * 響應式斷點
 */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
};

/**
 * 動畫預設
 */
export const animations = {
  fadeIn: {
    duration: 300,
    delay: 0,
    opacity: { from: 0, to: 1 },
  },
  slideInUp: {
    duration: 300,
    delay: 0,
    transform: { from: 'translateY(20px)', to: 'translateY(0)' },
  },
  slideInDown: {
    duration: 300,
    delay: 0,
    transform: { from: 'translateY(-20px)', to: 'translateY(0)' },
  },
  scaleIn: {
    duration: 250,
    delay: 0,
    transform: { from: 'scale(0.95)', to: 'scale(1)' },
  },
  bounce: {
    duration: 600,
    delay: 0,
    keyframes: [
      { offset: 0, transform: 'translateY(0)' },
      { offset: 0.5, transform: 'translateY(-10px)' },
      { offset: 1, transform: 'translateY(0)' },
    ],
  },
};

/**
 * 按鈕樣式預設
 */
export const buttonStyles = {
  primary: {
    backgroundColor: designTokens.colors.primary,
    color: '#fff',
    padding: `${designTokens.spacing.md}px ${designTokens.spacing.lg}px`,
    borderRadius: designTokens.borderRadius.md,
    fontWeight: '600',
  },
  secondary: {
    backgroundColor: designTokens.colors.surface,
    color: designTokens.colors.primary,
    padding: `${designTokens.spacing.md}px ${designTokens.spacing.lg}px`,
    borderRadius: designTokens.borderRadius.md,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: designTokens.colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    color: designTokens.colors.primary,
    padding: `${designTokens.spacing.md}px ${designTokens.spacing.lg}px`,
    fontWeight: '600',
  },
};

/**
 * 卡片樣式預設
 */
export const cardStyles = {
  default: {
    backgroundColor: designTokens.colors.surface,
    borderRadius: designTokens.borderRadius.lg,
    padding: designTokens.spacing.lg,
    ...designTokens.shadows.md,
  },
  elevated: {
    backgroundColor: designTokens.colors.background,
    borderRadius: designTokens.borderRadius.lg,
    padding: designTokens.spacing.lg,
    ...designTokens.shadows.lg,
  },
  outlined: {
    backgroundColor: designTokens.colors.background,
    borderRadius: designTokens.borderRadius.lg,
    padding: designTokens.spacing.lg,
    borderWidth: 1,
    borderColor: designTokens.colors.border,
  },
};

/**
 * 輸入框樣式預設
 */
export const inputStyles = {
  default: {
    borderRadius: designTokens.borderRadius.md,
    padding: `${designTokens.spacing.md}px`,
    borderWidth: 1,
    borderColor: designTokens.colors.border,
    fontSize: designTokens.typography.body.fontSize,
  },
  focused: {
    borderColor: designTokens.colors.primary,
    borderWidth: 2,
  },
  error: {
    borderColor: designTokens.colors.error,
  },
};

/**
 * 響應式工具
 */
export const responsive = {
  isMobile: (width: number) => width < breakpoints.tablet,
  isTablet: (width: number) => width >= breakpoints.tablet && width < breakpoints.desktop,
  isDesktop: (width: number) => width >= breakpoints.desktop,
  isWide: (width: number) => width >= breakpoints.wide,
};

/**
 * 顏色工具
 */
export const colorUtils = {
  hexToRgb: (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  },

  rgbToHex: (r: number, g: number, b: number) => {
    return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
  },

  adjustBrightness: (hex: string, percent: number) => {
    const rgb = colorUtils.hexToRgb(hex);
    if (!rgb) return hex;

    const adjusted = {
      r: Math.round(rgb.r * (1 + percent / 100)),
      g: Math.round(rgb.g * (1 + percent / 100)),
      b: Math.round(rgb.b * (1 + percent / 100)),
    };

    return colorUtils.rgbToHex(adjusted.r, adjusted.g, adjusted.b);
  },
};

/**
 * 排版工具
 */
export const typographyUtils = {
  truncate: (lines: number = 1) => ({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: lines,
    WebkitBoxOrient: 'vertical',
  }),

  lineHeight: (fontSize: number, lineHeight: number) => ({
    fontSize,
    lineHeight: lineHeight * fontSize,
  }),
};
