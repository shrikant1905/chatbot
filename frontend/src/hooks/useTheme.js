import { useState, useEffect } from 'react';

export function useTheme() {
  const [themeMode, setThemeMode] = useState(() => {
    try {
      return localStorage.getItem('kiaan-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  const [activeTheme, setActiveTheme] = useState('dark');

  useEffect(() => {
    const applyTheme = () => {
      let resolvedTheme = themeMode;
      if (themeMode === 'system') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolvedTheme = prefersDark ? 'dark' : 'light';
      }
      setActiveTheme(resolvedTheme);
      document.documentElement.setAttribute('data-theme', resolvedTheme);
      try {
        localStorage.setItem('kiaan-theme', themeMode);
      } catch (e) {
        console.error('LocalStorage unavailable for theme', e);
      }
    };

    applyTheme();

    if (themeMode === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return {
    themeMode,
    activeTheme,
    setThemeMode,
    toggleTheme
  };
}

