import React from 'react';
import { useTheme } from './hooks/useTheme';
import { ChatPage } from './pages/ChatPage';

export function App() {
  const { activeTheme, themeMode, setThemeMode, toggleTheme } = useTheme();

  return (
    <ChatPage
      activeTheme={activeTheme}
      themeMode={themeMode}
      setThemeMode={setThemeMode}
      onToggleTheme={toggleTheme}
    />
  );
}

export default App;

