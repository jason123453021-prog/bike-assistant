import fs from "node:fs";
import path from "node:path";

import { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";
import { SUPPLY_MODAL_COPY } from "../../lib/i18n/supply-modal-copy";

const rootDir = path.resolve(__dirname, "../..");

describe("補給待確認 Modal 多語系與 RTL 守門", () => {
  it("全部支援語言都有完整的確認、下一輪與稍後提醒文案", () => {
    expect(Object.keys(SUPPLY_MODAL_COPY)).toHaveLength(
      SUPPORTED_LOCALES.length,
    );
    for (const locale of SUPPORTED_LOCALES) {
      const copy = SUPPLY_MODAL_COPY[locale];
      for (const value of Object.values(copy)) {
        expect(value.trim()).not.toBe("");
        expect(value).not.toMatch(/^notifications\./);
      }
    }
  });

  it("Modal 使用目前語言、RTL 對齊與 AdaptiveFormText，而非使用硬編碼中文", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "components/supply-modal.tsx"),
      "utf8",
    );
    expect(source).toContain("useLanguage");
    expect(source).toContain("getSupplyModalCopy(activeLanguage)");
    expect(source).toContain("alertBlockHeaderRtl");
    expect(source).toContain("AdaptiveFormText");
    expect(source).not.toContain(">已補給能量<");
    expect(source).not.toContain(">稍後提醒<");
  });
});
