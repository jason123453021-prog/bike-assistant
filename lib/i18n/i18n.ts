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

type TranslationTree = Record<string, unknown>;

function isTranslationTree(value: unknown): value is TranslationTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 用英文基準字典補齊未逐字翻譯的 UI key；不覆寫任何 locale 已提供的譯文。 */
export function fillMissingTranslationKeys(fallback: TranslationTree, locale: TranslationTree): TranslationTree {
  const merged: TranslationTree = { ...locale };
  for (const [key, fallbackValue] of Object.entries(fallback)) {
    const localeValue = locale[key];
    merged[key] = isTranslationTree(fallbackValue) && isTranslationTree(localeValue)
      ? fillMissingTranslationKeys(fallbackValue, localeValue)
      : localeValue ?? fallbackValue;
  }
  return merged;
}

export function findMissingTranslationKeys(reference: TranslationTree, candidate: TranslationTree, path = ""): string[] {
  return Object.entries(reference).flatMap(([key, referenceValue]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const candidateValue = candidate[key];
    if (candidateValue === undefined || candidateValue === null || candidateValue === "") return [nextPath];
    return isTranslationTree(referenceValue) && isTranslationTree(candidateValue)
      ? findMissingTranslationKeys(referenceValue, candidateValue, nextPath)
      : [];
  });
}

const rawLocaleResources: Record<SupportedLocale, TranslationTree> = {
  "zh-TW": zhTW, "zh-CN": zhCN, "en-US": enUS, "ja-JP": jaJP, "ko-KR": koKR,
  "es-ES": esES, "pt-BR": ptBR, "fr-FR": frFR, "de-DE": deDE, "it-IT": itIT,
  "nl-NL": nlNL, "ru-RU": ruRU, "ar-SA": arSA,
};

export const LOCALE_RESOURCES: Record<SupportedLocale, TranslationTree> = Object.fromEntries(
  SUPPORTED_LOCALES.map((locale) => [locale, fillMissingTranslationKeys(enUS, rawLocaleResources[locale])]),
) as Record<SupportedLocale, TranslationTree>;

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
  resources: Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, { translation: LOCALE_RESOURCES[locale] }])),
  lng: resolveSystemLocale(), fallbackLng: "en-US", supportedLngs: [...SUPPORTED_LOCALES], load: "currentOnly", saveMissing: false,
  returnNull: false, returnEmptyString: false, interpolation: { escapeValue: false },
});
export default i18n;
