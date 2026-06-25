import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import ms from './locales/ms.json';

const LANG_KEY = 'language_preference';

async function detectLanguage(): Promise<string> {
  try {
    const saved = await AsyncStorage.getItem(LANG_KEY);
    if (saved === 'ms' || saved === 'en') return saved;
  } catch {}
  // Fall back to 'en' since expo-localization isn't guaranteed available on all builds
  return 'en';
}

export async function initI18n() {
  const lng = await detectLanguage();
  await i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ms: { translation: ms } },
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });
}

export async function setLanguage(lang: 'en' | 'ms') {
  await AsyncStorage.setItem(LANG_KEY, lang);
  await i18n.changeLanguage(lang);
}

export { i18n };
