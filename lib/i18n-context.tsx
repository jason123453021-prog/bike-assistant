/**
 * i18n Context - 提供全應用程式的國際化支援
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { LanguageCode, t as i18nT, getSupportedLanguages, getSystemLanguage } from './i18n';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => Promise<void>;
  t: (key: string, variables?: Record<string, string | number>) => string;
  supportedLanguages: LanguageCode[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const LANGUAGE_STORAGE_KEY = '@bike_assistant/language';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('zh-TW');
  const [isLoaded, setIsLoaded] = useState(false);

  // 初始化語言設定
  React.useEffect(() => {
    const initLanguage = async () => {
      try {
        // 先嘗試從本地存儲讀取
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved) {
          setLanguageState(saved as LanguageCode);
        } else {
          // 使用系統語言
          const systemLang = getSystemLanguage();
          setLanguageState(systemLang);
        }
      } catch (error) {
        console.error('[I18nProvider] Failed to load language:', error);
        setLanguageState('zh-TW');
      } finally {
        setIsLoaded(true);
      }
    };

    initLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: LanguageCode) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.error('[I18nProvider] Failed to save language:', error);
    }
  }, []);

  const t = useCallback(
    (key: string, variables?: Record<string, string | number>) => {
      return i18nT(key, language, variables);
    },
    [language]
  );

  if (!isLoaded) {
    return null; // 或返回加載中的佔位符
  }

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    supportedLanguages: getSupportedLanguages(),
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * 使用 i18n Context 的 Hook
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}

/**
 * 簡化版 Hook - 只返回翻譯函數
 */
export function useTranslation() {
  const { t } = useI18n();
  return { t };
}
