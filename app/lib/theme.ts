export type AppTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'instrio-theme';
export const THEME_CHANGE_EVENT = 'instrio-theme-change';
export const DEFAULT_THEME: AppTheme = 'dark';

export function isAppTheme(value: unknown): value is AppTheme {
  return value === 'dark' || value === 'light';
}

export function getStoredTheme(): AppTheme | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function readThemeFromDocument(): AppTheme {
  if (typeof document === 'undefined') {
    return DEFAULT_THEME;
  }

  const current = document.documentElement.dataset.theme;
  return isAppTheme(current) ? current : DEFAULT_THEME;
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  if (document.body) {
    document.body.style.colorScheme = theme;
  }
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore storage failures so the toggle still works for the session.
  }
}

export const THEME_INIT_SCRIPT = `
  (function () {
    try {
      var stored = window.localStorage.getItem('${THEME_STORAGE_KEY}');
      var theme = stored === 'light' || stored === 'dark' ? stored : '${DEFAULT_THEME}';
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
      if (document.body) {
        document.body.style.colorScheme = theme;
      }
    } catch (error) {
      document.documentElement.dataset.theme = '${DEFAULT_THEME}';
      document.documentElement.style.colorScheme = '${DEFAULT_THEME}';
      if (document.body) {
        document.body.style.colorScheme = '${DEFAULT_THEME}';
      }
    }
  })();
`;
