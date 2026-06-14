'use client';

import { useEffect, useState } from 'react';
import {
  AppTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  applyTheme,
  getStoredTheme,
  persistTheme,
  readThemeFromDocument,
} from '@/app/lib/theme';

interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
  label?: string | false;
  showValue?: boolean;
}

export function ThemeToggle({
  className = '',
  compact = false,
  label,
  showValue,
}: ThemeToggleProps) {
  const [theme, setTheme] = useState<AppTheme>(() => {
    if (typeof window === 'undefined') {
      return 'dark';
    }

    return getStoredTheme() ?? readThemeFromDocument();
  });

  useEffect(() => {
    const syncTheme = (nextTheme?: AppTheme) => {
      const resolvedTheme = nextTheme ?? getStoredTheme() ?? readThemeFromDocument();
      applyTheme(resolvedTheme);
      setTheme(resolvedTheme);
    };

    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme();
      }
    };

    const handleThemeChange = (event: Event) => {
      const nextTheme =
        event instanceof CustomEvent && (event.detail === 'dark' || event.detail === 'light')
          ? event.detail
          : undefined;
      syncTheme(nextTheme);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  const nextTheme: AppTheme = theme === 'dark' ? 'light' : 'dark';
  const resolvedLabel = label === false ? null : label ?? (compact ? null : 'Theme');
  const resolvedShowValue = showValue ?? !compact;

  const handleToggle = () => {
    applyTheme(nextTheme);
    persistTheme(nextTheme);
    setTheme(nextTheme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: nextTheme }));
  };

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${theme} ${compact ? 'theme-toggle--compact' : ''} ${className}`.trim()}
      onClick={handleToggle}
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      {resolvedLabel && <span className="theme-toggle-label">{resolvedLabel}</span>}
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb" />
      </span>
      {resolvedShowValue && <span className="theme-toggle-value">{theme}</span>}
    </button>
  );
}
