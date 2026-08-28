import fs from "node:fs";
import path from "node:path";

import i18n from "../../lib/i18n/i18n";

const rootDir = path.resolve(__dirname, "../..");

describe("活動編輯與表單驗證 i18n 守門", () => {
  afterEach(async () => {
    await i18n.changeLanguage("zh-TW");
  });

  it("活動編輯 Modal 與補給品表單的繁中、英文文案均可即時切換", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("forms.activityEditor.equipmentLabel")).toBe(
      "Equipment notes",
    );
    expect(i18n.t("forms.activityEditor.coverPhotoHint")).toContain(
      "local photo",
    );
    expect(i18n.t("forms.supplyItem.addTitle")).toBe("Add supply item");
    expect(i18n.t("forms.errors.distancePositive")).toBe(
      "Distance must be greater than zero.",
    );
    expect(
      i18n.t("settingsActions.simplifiedLimitBody", { count: 6 }),
    ).toContain("6 fields");

    await i18n.changeLanguage("zh-TW");
    expect(i18n.t("forms.activityEditor.equipmentLabel")).toBe("裝備備註");
    expect(i18n.t("forms.activityEditor.coverEmpty")).toContain("活動封面");
    expect(i18n.t("forms.supplyItem.addTitle")).toBe("新增補給品");
    expect(i18n.t("forms.errors.timePositive")).toBe("時間必須大於 0。");
    expect(i18n.t("settingsActions.resetAllLabel")).toBe("重設所有設定");
  });

  it("活動編輯、設定數值與自訂補給品三條表單路徑均使用翻譯 key 呈現驗證提示", () => {
    const detail = fs.readFileSync(
      path.join(rootDir, "app/ride-detail.tsx"),
      "utf8",
    );
    const settings = fs.readFileSync(
      path.join(rootDir, "app/(tabs)/settings.tsx"),
      "utf8",
    );
    const supplyModal = fs.readFileSync(
      path.join(rootDir, "components/custom-supply-item-modal.tsx"),
      "utf8",
    );

    for (const key of [
      "equipmentLabel",
      "privateNotesPlaceholder",
      "coverPhotoHint",
      "clearCover",
      "localMedia",
      "mediaEmpty",
    ]) {
      expect(detail).toContain(`forms.activityEditor.${key}`);
    }
    for (const key of ["birthdayBody", "numberBody", "supplyNameRequired"]) {
      expect(settings).toContain(`t(\"forms.errors.${key}\")`);
    }
    expect(settings).toContain("editInlineError");
    for (const key of [
      "supplyNameRequired",
      "distancePositive",
      "timePositive",
    ]) {
      expect(supplyModal).toContain(`t('forms.errors.${key}')`);
    }
    expect(supplyModal).toContain("useTranslation");
  });

  it("保留 Android 實機 RTL 與長字串表單驗收步驟", () => {
    const guide = fs.readFileSync(
      path.join(
        rootDir,
        "references/android-rtl-form-validation-device-validation-2026-08-25.md",
      ),
      "utf8",
    );
    expect(guide).toContain("العربية");
    expect(guide).toContain("即時驗證");
    expect(guide).toContain("System & Data → Language");
    expect(guide).not.toContain("清理地圖與暫存軌跡");
  });
});
