import fs from "node:fs";
import path from "node:path";

import i18n, { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";

const localeDirectory = path.resolve(__dirname, "../../lib/i18n/locales");

function readEnglishAudit(): Record<string, string> {
  const source = fs.readFileSync(
    path.join(localeDirectory, "en-US.json"),
    "utf8",
  );
  return JSON.parse(source).audit;
}

function placeholders(value: string) {
  return [...value.matchAll(/{{\s*([^}\s]+)\s*}}/g)]
    .map((match) => match[1])
    .sort();
}

describe("audit locale runtime coverage", () => {
  const englishAudit = readEnglishAudit();

  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it.each(SUPPORTED_LOCALES)(
    "%s resolves every audit key through its own resource or zh-TW → en-US fallback",
    async (locale) => {
      await i18n.changeLanguage(locale);

      for (const [key, englishValue] of Object.entries(englishAudit)) {
        const resolved = i18n.t(`audit.${key}`);
        expect(resolved).not.toBe(`audit.${key}`);
        expect(resolved.trim()).not.toBe("");
        expect(placeholders(resolved)).toEqual(placeholders(englishValue));
      }
    },
  );
});
