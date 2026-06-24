/**
 * i18n 國際化管理工具
 * 支援繁體中文 (zh-TW)、簡體中文 (zh-CN)、英文 (en)
 */

// 導入翻譯資源
import zhTW from '../locales/zh-TW.json';
import zhCN from '../locales/zh-CN.json';
import en from '../locales/en.json';

export type LanguageCode = 'zh-TW' | 'zh-CN' | 'en';

interface TranslationResources {
  [key: string]: any;
}

const translations: Record<LanguageCode, TranslationResources> = {
  'zh-TW': zhTW,
  'zh-CN': zhCN,
  'en': en,
};

const SUPPORTED_LANGUAGES: LanguageCode[] = ['zh-TW', 'zh-CN', 'en'];

/**
 * 獲取系統語言（暫時返回預設值，後續可整合 expo-localization）
 */
export function getSystemLanguage(): LanguageCode {
  // TODO: 整合 expo-localization 以自動偵測系統語言
  // 目前返回預設繁體中文
  return 'zh-TW';
}

/**
 * 獲取嵌套物件中的值
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, prop) => {
    return current?.[prop];
  }, obj);
}

/**
 * 翻譯字符串，支援變數替換
 * @param key 翻譯鍵，使用點號分隔嵌套路徑 (e.g., 'supply.title')
 * @param language 語言代碼
 * @param variables 變數替換對象 (e.g., { ml: 250 })
 * @returns 翻譯後的字符串
 */
export function t(
  key: string,
  language: LanguageCode = 'zh-TW',
  variables?: Record<string, string | number>
): string {
  const translation = getNestedValue(translations[language], key);
  
  if (!translation) {
    console.warn(`[i18n] Missing translation: ${key} for language ${language}`);
    return key;
  }
  
  // 變數替換
  if (variables) {
    let result = translation;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(`{{${key}}}`, String(value));
    });
    return result;
  }
  
  return translation;
}

/**
 * 創建語言上下文 Hook 使用的工具
 */
export function createI18nHelper(language: LanguageCode) {
  return {
    t: (key: string, variables?: Record<string, string | number>) =>
      t(key, language, variables),
    language,
  };
}

/**
 * 驗證語言代碼
 */
export function isValidLanguage(lang: any): lang is LanguageCode {
  return SUPPORTED_LANGUAGES.includes(lang);
}

/**
 * 獲取所有支援的語言
 */
export function getSupportedLanguages(): LanguageCode[] {
  return [...SUPPORTED_LANGUAGES];
}

/**
 * 獲取語言顯示名稱
 */
export function getLanguageName(lang: LanguageCode): string {
  const names: Record<LanguageCode, string> = {
    'zh-TW': '繁體中文',
    'zh-CN': '简体中文',
    'en': 'English',
  };
  return names[lang] || lang;
}
