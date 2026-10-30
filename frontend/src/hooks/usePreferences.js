import { useState, useEffect } from 'react';

const PREF_TIMESTAMPS_KEY = 'kiaan_pref_timestamps';
const PREF_LINENUMBERS_KEY = 'kiaan_pref_linenumbers';
const PREF_SOUNDS_KEY = 'kiaan_pref_sounds';

export function usePreferences() {
  const [preferences, setPreferences] = useState(() => {
    try {
      const storedTimestamps = localStorage.getItem(PREF_TIMESTAMPS_KEY);
      const storedLineNumbers = localStorage.getItem(PREF_LINENUMBERS_KEY);
      const storedSounds = localStorage.getItem(PREF_SOUNDS_KEY);

      return {
        showTimestamps: storedTimestamps !== null ? storedTimestamps === 'true' : true,
        codeLineNumbers: storedLineNumbers === 'true',
        soundEffects: storedSounds === 'true'
      };
    } catch {
      return {
        showTimestamps: true,
        codeLineNumbers: false,
        soundEffects: false
      };
    }
  });

  const updatePreferences = (newPrefs) => {
    setPreferences((prev) => {
      const merged = { ...prev, ...newPrefs };
      try {
        localStorage.setItem(PREF_TIMESTAMPS_KEY, String(merged.showTimestamps));
        localStorage.setItem(PREF_LINENUMBERS_KEY, String(merged.codeLineNumbers));
        localStorage.setItem(PREF_SOUNDS_KEY, String(merged.soundEffects));
      } catch (err) {
        console.warn('Could not persist preferences to localStorage:', err);
      }
      return merged;
    });
  };

  return { preferences, updatePreferences };
}

