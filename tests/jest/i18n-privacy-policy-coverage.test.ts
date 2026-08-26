import fs from "node:fs";
import path from "node:path";

import i18n, { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";

const rootDir = path.resolve(__dirname, "../..");
const sectionKeys = [
  "introduction",
  "collection",
  "use",
  "storage",
  "sharing",
  "rights",
  "children",
  "locationPermissions",
  "notificationPermissions",
  "security",
  "changes",
  "contact",
] as const;

describe("隱私政策 i18n 與 RTL 守門", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it("所有支援語系都以自身資源或 zh-TW → en-US 順序解析完整隱私政策段落", async () => {
    for (const locale of SUPPORTED_LOCALES) {
      await i18n.changeLanguage(locale);
      for (const section of sectionKeys) {
        for (const field of ["title", "body"] as const) {
          const key = `privacy.sections.${section}.${field}`;
          const resolved = i18n.t(key);
          expect(resolved).not.toBe(key);
          expect(resolved.trim()).not.toBe("");
        }
      }
    }
  });

  it("日文、韓文與 Arabic 提供自己的完整段落草案，Arabic 入口與本文採 RTL 對齊", () => {
    for (const locale of ["ja-JP", "ko-KR", "ar-SA"]) {
      const resource = JSON.parse(
        fs.readFileSync(
          path.join(rootDir, "lib/i18n/locales", `${locale}.json`),
          "utf8",
        ),
      );
      for (const section of sectionKeys) {
        expect(resource.privacy.sections[section].title.trim()).not.toBe("");
        expect(resource.privacy.sections[section].body.trim()).not.toBe("");
      }
      expect(resource.audit.privacyPolicy.trim()).not.toBe("");
    }

    const privacyScreen = fs.readFileSync(
      path.join(rootDir, "app/privacy.tsx"),
      "utf8",
    );
    expect(privacyScreen).toContain("const { isRTL } = useLanguage()");
    expect(privacyScreen).toContain('textAlign: isRtl ? "right" : "left"');
    expect(privacyScreen).toContain("PRIVACY_SECTION_KEYS.map");
  });

  it("設定頁與根路由提供可及的隱私政策入口", () => {
    const settings = fs.readFileSync(
      path.join(rootDir, "app/(tabs)/settings.tsx"),
      "utf8",
    );
    const rootLayout = fs.readFileSync(
      path.join(rootDir, "app/_layout.tsx"),
      "utf8",
    );
    expect(settings).toContain('accessibilityLabel={t("audit.privacyPolicy")}');
    expect(settings).toContain('router.push("/privacy")');
    expect(rootLayout).toContain('<Stack.Screen name="privacy"');
  });
});
