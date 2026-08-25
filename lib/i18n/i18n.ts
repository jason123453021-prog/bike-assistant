import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import deDE from "./locales/de-DE.json";
import arSA from "./locales/ar-SA.json";
import enUS from "./locales/en-US.json";
import esES from "./locales/es-ES.json";
import frFR from "./locales/fr-FR.json";
import itIT from "./locales/it-IT.json";
import jaJP from "./locales/ja-JP.json";
import koKR from "./locales/ko-KR.json";
import nlNL from "./locales/nl-NL.json";
import ptBR from "./locales/pt-BR.json";
import ruRU from "./locales/ru-RU.json";
import zhCN from "./locales/zh-CN.json";
import zhTW from "./locales/zh-TW.json";
import { isSupportedLocale, SUPPORTED_LOCALES, type LanguagePreference, type SupportedLocale } from "./types";

export { SUPPORTED_LOCALES, type LanguagePreference, type SupportedLocale } from "./types";
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLocale, string> = { "zh-TW": "繁體中文", "zh-CN": "简体中文", "en-US": "English (US)", "ja-JP": "日本語", "ko-KR": "한국어", "es-ES": "Español", "pt-BR": "Português (Brasil)", "fr-FR": "Français", "de-DE": "Deutsch", "it-IT": "Italiano", "nl-NL": "Nederlands", "ru-RU": "Русский", "ar-SA": "العربية" };
const LANGUAGE_FALLBACKS: Record<string, SupportedLocale> = { zh: "zh-TW", en: "en-US", ja: "ja-JP", ko: "ko-KR", es: "es-ES", pt: "pt-BR", fr: "fr-FR", de: "de-DE", it: "it-IT", nl: "nl-NL", ru: "ru-RU", ar: "ar-SA" };

export function normalizeLocaleTag(tag: string | null | undefined): SupportedLocale {
  if (!tag) return "en-US";
  const normalized = tag.replace(/_/g, "-");
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === normalized.toLowerCase());
  if (exact && isSupportedLocale(exact)) return exact;
  return LANGUAGE_FALLBACKS[normalized.split("-")[0].toLowerCase()] ?? "en-US";
}
export function resolveSystemLocale(languageTags?: readonly string[]): SupportedLocale {
  const tags = languageTags ?? (() => {
    if (typeof navigator === "undefined") return [];
    return navigator.languages?.length ? navigator.languages : [navigator.language];
  })();
  return normalizeLocaleTag(tags[0]);
}
export function resolveLanguagePreference(preference: LanguagePreference, languageTags?: readonly string[]): SupportedLocale {
  return preference === "system" ? resolveSystemLocale(languageTags) : preference;
}

void i18n.use(initReactI18next).init({
  resources: { "zh-TW": { translation: zhTW }, "zh-CN": { translation: zhCN }, "en-US": { translation: enUS }, "ja-JP": { translation: jaJP }, "ko-KR": { translation: koKR }, "es-ES": { translation: esES }, "pt-BR": { translation: ptBR }, "fr-FR": { translation: frFR }, "de-DE": { translation: deDE }, "it-IT": { translation: itIT }, "nl-NL": { translation: nlNL }, "ru-RU": { translation: ruRU }, "ar-SA": { translation: arSA } },
  lng: resolveSystemLocale(), fallbackLng: "en-US", supportedLngs: [...SUPPORTED_LOCALES], load: "currentOnly", saveMissing: false,
  returnNull: false, returnEmptyString: false, interpolation: { escapeValue: false },
});
export default i18n;
