import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';

export function ThemeToggle({ activeTheme, onToggle }) {
  const isDark = activeTheme === 'dark';

  return (
    <button
      className="header-icon-btn"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? <FiSun style={{ color: '#fbbf24', fontSize: '18px' }} /> : <FiMoon style={{ color: '#6366f1', fontSize: '18px' }} />}
    </button>
  );
}
