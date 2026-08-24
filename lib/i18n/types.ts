export const SUPPORTED_LOCALES = [
  "zh-TW", "zh-CN", "en-US", "ja-JP", "ko-KR", "es-ES",
  "pt-BR", "fr-FR", "de-DE", "it-IT", "nl-NL", "ru-RU",
] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export type LanguagePreference = "system" | SupportedLocale;
export const LANGUAGE_PREFERENCE_STORAGE_KEY = "language_preference";

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === "system" || isSupportedLocale(value);
}
