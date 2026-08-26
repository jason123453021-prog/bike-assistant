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
import coreEnUS from "./locales/core-ui.en-US.json";
import coreArSA from "./locales/core-ui.ar-SA.json";
import coreDeDE from "./locales/core-ui.de-DE.json";
import coreEsES from "./locales/core-ui.es-ES.json";
import coreFrFR from "./locales/core-ui.fr-FR.json";
import coreItIT from "./locales/core-ui.it-IT.json";
import coreJaJP from "./locales/core-ui.ja-JP.json";
import coreKoKR from "./locales/core-ui.ko-KR.json";
import coreNlNL from "./locales/core-ui.nl-NL.json";
import corePtBR from "./locales/core-ui.pt-BR.json";
import coreRuRU from "./locales/core-ui.ru-RU.json";
import coreZhCN from "./locales/core-ui.zh-CN.json";
import coreZhTW from "./locales/core-ui.zh-TW.json";
import { PERMISSION_TRANSLATIONS } from "./permission-translations";
import {
  isSupportedLocale,
  SUPPORTED_LOCALES,
  type LanguagePreference,
  type SupportedLocale,
} from "./types";

export {
  SUPPORTED_LOCALES,
  type LanguagePreference,
  type SupportedLocale,
} from "./types";
export const LANGUAGE_NATIVE_NAMES: Record<SupportedLocale, string> = {
  "zh-TW": "繁體中文",
  "zh-CN": "简体中文",
  "en-US": "English (US)",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "es-ES": "Español",
  "pt-BR": "Português (Brasil)",
  "fr-FR": "Français",
  "de-DE": "Deutsch",
  "it-IT": "Italiano",
  "nl-NL": "Nederlands",
  "ru-RU": "Русский",
  "ar-SA": "العربية",
};
const LANGUAGE_FALLBACKS: Record<string, SupportedLocale> = {
  zh: "zh-TW",
  en: "en-US",
  ja: "ja-JP",
  ko: "ko-KR",
  es: "es-ES",
  pt: "pt-BR",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  nl: "nl-NL",
  ru: "ru-RU",
  ar: "ar-SA",
};

type TranslationTree = Record<string, unknown>;

function isTranslationTree(value: unknown): value is TranslationTree {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 用英文基準字典補齊未逐字翻譯的 UI key；不覆寫任何 locale 已提供的譯文。 */
export function fillMissingTranslationKeys(
  fallback: TranslationTree,
  locale: TranslationTree,
): TranslationTree {
  const merged: TranslationTree = { ...locale };
  for (const [key, fallbackValue] of Object.entries(fallback)) {
    const localeValue = locale[key];
    merged[key] =
      isTranslationTree(fallbackValue) && isTranslationTree(localeValue)
        ? fillMissingTranslationKeys(fallbackValue, localeValue)
        : (localeValue ?? fallbackValue);
  }
  return merged;
}

export function findMissingTranslationKeys(
  reference: TranslationTree,
  candidate: TranslationTree,
  path = "",
): string[] {
  return Object.entries(reference).flatMap(([key, referenceValue]) => {
    const nextPath = path ? `${path}.${key}` : key;
    const candidateValue = candidate[key];
    if (
      candidateValue === undefined ||
      candidateValue === null ||
      candidateValue === ""
    )
      return [nextPath];
    return isTranslationTree(referenceValue) &&
      isTranslationTree(candidateValue)
      ? findMissingTranslationKeys(referenceValue, candidateValue, nextPath)
      : [];
  });
}

const coreUiResources: Record<SupportedLocale, TranslationTree> = {
  "zh-TW": coreZhTW,
  "zh-CN": coreZhCN,
  "en-US": coreEnUS,
  "ja-JP": coreJaJP,
  "ko-KR": coreKoKR,
  "es-ES": coreEsES,
  "pt-BR": corePtBR,
  "fr-FR": coreFrFR,
  "de-DE": coreDeDE,
  "it-IT": coreItIT,
  "nl-NL": coreNlNL,
  "ru-RU": coreRuRU,
  "ar-SA": coreArSA,
};

const rawLocaleResources: Record<SupportedLocale, TranslationTree> = {
  "zh-TW": fillMissingTranslationKeys(
    fillMissingTranslationKeys(zhTW, coreUiResources["zh-TW"]),
    { permissions: PERMISSION_TRANSLATIONS["zh-TW"] },
  ),
  "zh-CN": fillMissingTranslationKeys(
    fillMissingTranslationKeys(zhCN, coreUiResources["zh-CN"]),
    { permissions: PERMISSION_TRANSLATIONS["zh-CN"] },
  ),
  "en-US": fillMissingTranslationKeys(
    fillMissingTranslationKeys(enUS, coreUiResources["en-US"]),
    { permissions: PERMISSION_TRANSLATIONS["en-US"] },
  ),
  "ja-JP": fillMissingTranslationKeys(
    fillMissingTranslationKeys(jaJP, coreUiResources["ja-JP"]),
    { permissions: PERMISSION_TRANSLATIONS["ja-JP"] },
  ),
  "ko-KR": fillMissingTranslationKeys(
    fillMissingTranslationKeys(koKR, coreUiResources["ko-KR"]),
    { permissions: PERMISSION_TRANSLATIONS["ko-KR"] },
  ),
  "es-ES": fillMissingTranslationKeys(
    fillMissingTranslationKeys(esES, coreUiResources["es-ES"]),
    { permissions: PERMISSION_TRANSLATIONS["es-ES"] },
  ),
  "pt-BR": fillMissingTranslationKeys(
    fillMissingTranslationKeys(ptBR, coreUiResources["pt-BR"]),
    { permissions: PERMISSION_TRANSLATIONS["pt-BR"] },
  ),
  "fr-FR": fillMissingTranslationKeys(
    fillMissingTranslationKeys(frFR, coreUiResources["fr-FR"]),
    { permissions: PERMISSION_TRANSLATIONS["fr-FR"] },
  ),
  "de-DE": fillMissingTranslationKeys(
    fillMissingTranslationKeys(deDE, coreUiResources["de-DE"]),
    { permissions: PERMISSION_TRANSLATIONS["de-DE"] },
  ),
  "it-IT": fillMissingTranslationKeys(
    fillMissingTranslationKeys(itIT, coreUiResources["it-IT"]),
    { permissions: PERMISSION_TRANSLATIONS["it-IT"] },
  ),
  "nl-NL": fillMissingTranslationKeys(
    fillMissingTranslationKeys(nlNL, coreUiResources["nl-NL"]),
    { permissions: PERMISSION_TRANSLATIONS["nl-NL"] },
  ),
  "ru-RU": fillMissingTranslationKeys(
    fillMissingTranslationKeys(ruRU, coreUiResources["ru-RU"]),
    { permissions: PERMISSION_TRANSLATIONS["ru-RU"] },
  ),
  "ar-SA": fillMissingTranslationKeys(
    fillMissingTranslationKeys(arSA, coreUiResources["ar-SA"]),
    { permissions: PERMISSION_TRANSLATIONS["ar-SA"] },
  ),
};

const englishReference = rawLocaleResources["en-US"];
export const LOCALE_RESOURCES: Record<SupportedLocale, TranslationTree> =
  Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      fillMissingTranslationKeys(englishReference, rawLocaleResources[locale]),
    ]),
  ) as Record<SupportedLocale, TranslationTree>;

export function normalizeLocaleTag(
  tag: string | null | undefined,
): SupportedLocale {
  if (!tag) return "en-US";
  const normalized = tag.replace(/_/g, "-");
  const exact = SUPPORTED_LOCALES.find(
    (locale) => locale.toLowerCase() === normalized.toLowerCase(),
  );
  if (exact && isSupportedLocale(exact)) return exact;
  return LANGUAGE_FALLBACKS[normalized.split("-")[0].toLowerCase()] ?? "en-US";
}
export function resolveSystemLocale(
  languageTags?: readonly string[],
): SupportedLocale {
  const tags =
    languageTags ??
    (() => {
      if (typeof navigator === "undefined") return [];
      return navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
    })();
  return normalizeLocaleTag(tags[0]);
}
export function resolveLanguagePreference(
  preference: LanguagePreference,
  languageTags?: readonly string[],
): SupportedLocale {
  return preference === "system"
    ? resolveSystemLocale(languageTags)
    : preference;
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      { translation: LOCALE_RESOURCES[locale] },
    ]),
  ),
  lng: resolveSystemLocale(),
  fallbackLng: ["zh-TW", "en-US"],
  supportedLngs: [...SUPPORTED_LOCALES],
  load: "currentOnly",
  saveMissing: false,
  returnNull: false,
  returnEmptyString: false,
  interpolation: { escapeValue: false },
});
export default i18n;
