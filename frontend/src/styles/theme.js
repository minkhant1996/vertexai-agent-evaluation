/**
 * SoeMind Foundry Theme
 *
 * Color palette designed for a professional startup validation tool.
 * Dark theme with accent colors for different validation stages.
 */

export const theme = {
  // Base colors
  colors: {
    // Background layers
    bg: {
      primary: 'bg-slate-950',      // Main background
      secondary: 'bg-slate-900',    // Cards, panels
      tertiary: 'bg-slate-800',     // Elevated elements
      hover: 'bg-slate-800/50',     // Hover states
    },

    // Border colors
    border: {
      default: 'border-slate-800',
      light: 'border-slate-700',
      focus: 'border-indigo-500',
    },

    // Text colors
    text: {
      primary: 'text-slate-100',
      secondary: 'text-slate-400',
      muted: 'text-slate-500',
    },

    // Accent colors - each represents a validation stage
    accent: {
      // Indigo - Primary brand color
      primary: {
        bg: 'bg-indigo-600',
        bgHover: 'hover:bg-indigo-700',
        bgSubtle: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500',
      },

      // Emerald - Success, passed tests, validated
      success: {
        bg: 'bg-emerald-600',
        bgHover: 'hover:bg-emerald-700',
        bgSubtle: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500',
      },

      // Amber - Warning, attention needed
      warning: {
        bg: 'bg-amber-600',
        bgHover: 'hover:bg-amber-700',
        bgSubtle: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500',
      },

      // Rose - Error, failed tests, red flags
      error: {
        bg: 'bg-rose-600',
        bgHover: 'hover:bg-rose-700',
        bgSubtle: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500',
      },

      // Violet - Track 2 indicator
      track2: {
        bg: 'bg-violet-600',
        bgHover: 'hover:bg-violet-700',
        bgSubtle: 'bg-violet-500/10',
        text: 'text-violet-400',
        border: 'border-violet-500',
      },

      // Cyan - Observability, traces
      trace: {
        bg: 'bg-cyan-600',
        bgHover: 'hover:bg-cyan-700',
        bgSubtle: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500',
      },
    },

    // Difficulty colors for scenarios
    difficulty: {
      easy: {
        bg: 'bg-emerald-500/20',
        text: 'text-emerald-400',
        border: 'border-emerald-500/50',
      },
      medium: {
        bg: 'bg-amber-500/20',
        text: 'text-amber-400',
        border: 'border-amber-500/50',
      },
      hard: {
        bg: 'bg-rose-500/20',
        text: 'text-rose-400',
        border: 'border-rose-500/50',
      },
    },
  },

  // Spacing
  spacing: {
    page: 'p-6',
    card: 'p-4',
    section: 'mb-6',
  },

  // Border radius
  radius: {
    sm: 'rounded-md',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  },
}

// CSS variable-based theme for more flexibility
export const cssVars = {
  '--background': '222.2 84% 4.9%',
  '--foreground': '210 40% 98%',
  '--card': '222.2 84% 4.9%',
  '--card-foreground': '210 40% 98%',
  '--popover': '222.2 84% 4.9%',
  '--popover-foreground': '210 40% 98%',
  '--primary': '239 84% 67%',  // Indigo
  '--primary-foreground': '210 40% 98%',
  '--secondary': '217.2 32.6% 17.5%',
  '--secondary-foreground': '210 40% 98%',
  '--muted': '217.2 32.6% 17.5%',
  '--muted-foreground': '215 20.2% 65.1%',
  '--accent': '217.2 32.6% 17.5%',
  '--accent-foreground': '210 40% 98%',
  '--destructive': '0 62.8% 30.6%',
  '--destructive-foreground': '210 40% 98%',
  '--border': '217.2 32.6% 17.5%',
  '--input': '217.2 32.6% 17.5%',
  '--ring': '239 84% 67%',
  '--radius': '0.5rem',
}

export default theme
