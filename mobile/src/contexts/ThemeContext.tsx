import React, { createContext, useEffect, useState } from 'react';
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Themes, AppTheme, ThemeScheme } from '../utils/theme';

const STORAGE_KEY = 'theme_preference';

interface ThemeContextValue {
  scheme: ThemeScheme;
  colors: AppTheme;
  setScheme: (s: ThemeScheme | 'system') => void;
  preference: ThemeScheme | 'system';
}

export const ThemeContext = createContext<ThemeContextValue>({
  scheme: 'light',
  colors: Themes.light,
  setScheme: () => {},
  preference: 'system',
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<ThemeScheme | 'system'>('system');
  const [scheme, setSchemeState] = useState<ThemeScheme>(
    (Appearance.getColorScheme() as ThemeScheme) || 'light'
  );

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val === 'light' || val === 'dark' || val === 'system') {
        setPreference(val);
        if (val !== 'system') setSchemeState(val);
      }
    });
  }, []);

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (preference === 'system') {
        setSchemeState((colorScheme as ThemeScheme) || 'light');
      }
    });
    return () => sub.remove();
  }, [preference]);

  const setScheme = (pref: ThemeScheme | 'system') => {
    setPreference(pref);
    AsyncStorage.setItem(STORAGE_KEY, pref);
    if (pref === 'system') {
      setSchemeState((Appearance.getColorScheme() as ThemeScheme) || 'light');
    } else {
      setSchemeState(pref);
    }
  };

  return (
    <ThemeContext.Provider value={{ scheme, colors: Themes[scheme], setScheme, preference }}>
      {children}
    </ThemeContext.Provider>
  );
}
