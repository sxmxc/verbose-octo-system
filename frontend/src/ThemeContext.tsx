import React from 'react'

type ThemeName = 'light' | 'dark'

type ThemeContextValue = {
  theme: ThemeName
  toggleTheme: () => void
  setTheme: (theme: ThemeName) => void
  isDark: boolean
}

const THEME_STORAGE_KEY = 'sre-toolbox-theme'

const themeVariables: Record<ThemeName, Record<string, string>> = {
  light: {
    '--color-app-bg': '#f5f7fb',
    '--color-surface': '#ffffff',
    '--color-surface-alt': '#f8fafc',
    '--color-border': 'rgba(148, 163, 184, 0.25)',
    '--color-text-primary': '#0f172a',
    '--color-text-secondary': '#64748b',
    '--color-text-muted': '#94a3b8',
    '--color-link': '#0ea5e9',
    '--color-accent': '#38bdf8',
    '--color-accent-soft': 'rgba(56, 189, 248, 0.18)',
    '--color-sidebar-bg': '#0f172a',
    '--color-sidebar-text': '#e2e8f0',
    '--color-sidebar-muted': '#94a3b8',
    '--color-sidebar-item-bg': 'rgba(148, 163, 184, 0.12)',
    '--color-sidebar-item-active-bg': 'rgba(56, 189, 248, 0.22)',
    '--color-sidebar-item-text': '#cbd5f5',
    '--color-sidebar-item-active-text': '#0f172a',
    '--color-sidebar-button-bg': 'rgba(56, 189, 248, 0.18)',
    '--color-sidebar-button-text': '#0ea5e9',
    '--color-sidebar-button-active-bg': '#38bdf8',
    '--color-sidebar-button-active-text': '#0f172a',
    '--color-shadow': '0 8px 24px rgba(15, 23, 42, 0.08)',
    '--color-card-bg': '#ffffff',
    '--color-card-border': 'rgba(148, 163, 184, 0.25)',
    '--color-card-shadow': '0 8px 24px rgba(15, 23, 42, 0.06)',
    '--color-input-bg': '#ffffff',
    '--color-input-border': 'rgba(148, 163, 184, 0.45)',
    '--color-input-text': '#0f172a',
    '--color-input-placeholder': '#94a3b8',
    '--color-input-disabled-bg': 'rgba(148, 163, 184, 0.08)',
    '--color-input-disabled-border': 'rgba(148, 163, 184, 0.25)',
    '--color-input-disabled-text': 'rgba(15, 23, 42, 0.55)',
    '--color-button-bg': 'rgba(148, 163, 184, 0.12)',
    '--color-button-border': 'transparent',
    '--color-button-text': '#0f172a',
    '--color-button-hover-bg': 'rgba(148, 163, 184, 0.2)',
    '--color-button-hover-border': 'transparent',
    '--color-button-disabled-bg': 'rgba(148, 163, 184, 0.12)',
    '--color-button-disabled-text': 'rgba(15, 23, 42, 0.35)',
    '--color-button-muted-bg': 'rgba(148, 163, 184, 0.12)',
    '--color-button-muted-text': '#0f172a',
    '--color-button-muted-hover': 'rgba(148, 163, 184, 0.2)',
    '--color-button-primary-bg': '#0ea5e9',
    '--color-button-primary-text': '#0f172a',
    '--color-button-primary-hover': '#38bdf8',
    '--color-button-danger-bg': '#ef4444',
    '--color-button-danger-text': '#ffffff',
    '--color-button-danger-hover': '#dc2626',
    '--color-tag-bg': 'rgba(14, 165, 233, 0.12)',
    '--color-tag-text': '#0ea5e9',
    '--color-danger-bg': '#fee2e2',
    '--color-danger-border': '#f87171',
    '--color-warning-bg': '#fefce8',
    '--color-warning-border': '#facc15',
    '--color-warning-text': '#854d0e',
    '--color-outline': 'rgba(56, 189, 248, 0.5)',
    '--color-code-bg': '#0f172a',
    '--color-code-text': '#e2e8f0',
    '--color-surface-raised': '#ffffff',
  },
  dark: {
    '--color-app-bg': '#0b1220',
    '--color-surface': '#111c2f',
    '--color-surface-alt': '#17233a',
    '--color-border': 'rgba(94, 106, 135, 0.35)',
    '--color-text-primary': '#e2e8f0',
    '--color-text-secondary': '#a5b4fc',
    '--color-text-muted': '#64748b',
    '--color-link': '#38bdf8',
    '--color-accent': '#38bdf8',
    '--color-accent-soft': 'rgba(56, 189, 248, 0.25)',
    '--color-sidebar-bg': '#070b14',
    '--color-sidebar-text': '#cbd5f5',
    '--color-sidebar-muted': '#64748b',
    '--color-sidebar-item-bg': 'rgba(148, 163, 184, 0.1)',
    '--color-sidebar-item-active-bg': 'rgba(56, 189, 248, 0.3)',
    '--color-sidebar-item-text': '#9ca5ff',
    '--color-sidebar-item-active-text': '#041118',
    '--color-sidebar-button-bg': 'rgba(56, 189, 248, 0.18)',
    '--color-sidebar-button-text': '#38bdf8',
    '--color-sidebar-button-active-bg': '#38bdf8',
    '--color-sidebar-button-active-text': '#041118',
    '--color-shadow': '0 14px 36px rgba(3, 8, 20, 0.6)',
    '--color-card-bg': '#111c2f',
    '--color-card-border': 'rgba(94, 106, 135, 0.35)',
    '--color-card-shadow': '0 16px 28px rgba(3, 8, 20, 0.55)',
    '--color-input-bg': '#17233a',
    '--color-input-border': 'rgba(94, 106, 135, 0.45)',
    '--color-input-text': '#e2e8f0',
    '--color-input-placeholder': '#94a3b8',
    '--color-input-disabled-bg': 'rgba(15, 23, 42, 0.35)',
    '--color-input-disabled-border': 'rgba(94, 106, 135, 0.4)',
    '--color-input-disabled-text': 'rgba(226, 232, 240, 0.45)',
    '--color-button-bg': 'rgba(148, 163, 184, 0.16)',
    '--color-button-border': 'transparent',
    '--color-button-text': '#cbd5f5',
    '--color-button-hover-bg': 'rgba(148, 163, 184, 0.25)',
    '--color-button-hover-border': 'transparent',
    '--color-button-disabled-bg': 'rgba(148, 163, 184, 0.12)',
    '--color-button-disabled-text': 'rgba(203, 213, 245, 0.35)',
    '--color-button-muted-bg': 'rgba(148, 163, 184, 0.16)',
    '--color-button-muted-text': '#cbd5f5',
    '--color-button-muted-hover': 'rgba(148, 163, 184, 0.25)',
    '--color-button-primary-bg': '#1d4ed8',
    '--color-button-primary-text': '#e2e8f0',
    '--color-button-primary-hover': '#2563eb',
    '--color-button-danger-bg': '#ef4444',
    '--color-button-danger-text': '#fff',
    '--color-button-danger-hover': '#dc2626',
    '--color-tag-bg': 'rgba(59, 130, 246, 0.2)',
    '--color-tag-text': '#60a5fa',
    '--color-danger-bg': 'rgba(239, 68, 68, 0.18)',
    '--color-danger-border': 'rgba(239, 68, 68, 0.6)',
    '--color-warning-bg': 'rgba(250, 204, 21, 0.16)',
    '--color-warning-border': 'rgba(250, 204, 21, 0.45)',
    '--color-warning-text': '#fcd34d',
    '--color-outline': 'rgba(56, 189, 248, 0.4)',
    '--color-code-bg': '#090f1f',
    '--color-code-text': '#f8fafc',
    '--color-surface-raised': '#0d1627',
  },
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined)

function getInitialTheme(): ThemeName {
  if (typeof window === 'undefined') {
    return 'light'
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemeName | null
  if (stored && stored in themeVariables) {
    return stored
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyThemeVariables(theme: ThemeName) {
  if (typeof document === 'undefined') {
    return
  }
  const variables = themeVariables[theme]
  const root = document.documentElement
  Object.entries(variables).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.setAttribute('data-theme', theme)
  document.body.style.backgroundColor = 'var(--color-app-bg)'
  document.body.style.color = 'var(--color-text-primary)'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeName>(() => {
    const initial = getInitialTheme()
    if (typeof window !== 'undefined') {
      applyThemeVariables(initial)
    }
    return initial
  })

  React.useEffect(() => {
    applyThemeVariables(theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme)
    }
  }, [theme])

  const setTheme = React.useCallback((next: ThemeName) => {
    setThemeState(next)
  }, [])

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [])

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme, isDark: theme === 'dark' }),
    [theme, toggleTheme, setTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = React.useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
