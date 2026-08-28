import type { SupportedLocale } from "./types";

export type LayoutDirection = "ltr" | "rtl";

const RTL_LOCALES: readonly SupportedLocale[] = ["ar-SA"];

export function getLayoutDirection(locale: SupportedLocale): LayoutDirection {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

export function isRtlLocale(locale: SupportedLocale): boolean {
  return getLayoutDirection(locale) === "rtl";
}
