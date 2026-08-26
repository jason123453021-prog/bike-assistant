import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../..");

describe("i18n 過渡、RTL 與長字串版面守門", () => {
  const providerSource = fs.readFileSync(
    path.join(rootDir, "lib/i18n/language-provider.tsx"),
    "utf8",
  );
  const historySource = fs.readFileSync(
    path.join(rootDir, "app/(tabs)/history.tsx"),
    "utf8",
  );
  const routeSource = fs.readFileSync(
    path.join(rootDir, "app/(tabs)/navigate.tsx"),
    "utf8",
  );
  const settingsSource = fs.readFileSync(
    path.join(rootDir, "app/(tabs)/settings.tsx"),
    "utf8",
  );
  const supplyModalSource = fs.readFileSync(
    path.join(rootDir, "components/custom-supply-item-modal.tsx"),
    "utf8",
  );
  const adaptiveTextSource = fs.readFileSync(
    path.join(rootDir, "components/adaptive-form-text.tsx"),
    "utf8",
  );
  const activityDetailSource = fs.readFileSync(
    path.join(rootDir, "app/ride-detail.tsx"),
    "utf8",
  );
  const shareCardSource = fs.readFileSync(
    path.join(rootDir, "components/share-card-modal.tsx"),
    "utf8",
  );
  const maestroFontScaleGermanSource = fs.readFileSync(
    path.join(
      rootDir,
      "e2e/maestro/font-scale/localization-font-scale-de.yaml",
    ),
    "utf8",
  );
  const maestroFontScaleRussianSource = fs.readFileSync(
    path.join(
      rootDir,
      "e2e/maestro/font-scale/localization-font-scale-ru.yaml",
    ),
    "utf8",
  );
  const maestroFontScaleArabicSource = fs.readFileSync(
    path.join(
      rootDir,
      "e2e/maestro/font-scale/localization-font-scale-ar.yaml",
    ),
    "utf8",
  );
  const workflowSource = fs.readFileSync(
    path.join(rootDir, ".github/workflows/android-e2e.yml"),
    "utf8",
  );
  const deviceValidationSource = fs.readFileSync(
    path.join(
      rootDir,
      "references/android-font-scale-activity-share-device-validation-2026-08-25.md",
    ),
    "utf8",
  );

  it("語言切換以非阻塞淡入淡出遮罩回饋，並將 RTL direction 套用至全域內容", () => {
    expect(providerSource).toContain("Animated.timing");
    expect(providerSource).toContain("useNativeDriver: true");
    expect(providerSource).toContain('pointerEvents="none"');
    expect(providerSource).toContain("direction: layoutDirection");
    expect(providerSource).toContain("isSwitching");
  });

  it("歷史頁完整接入高可見文案、語系日期與可換行統計布局", () => {
    expect(historySource).toContain('t("history.title")');
    expect(historySource).toContain('t("history.searchPlaceholder")');
    expect(historySource).toContain("toLocaleDateString(activeLanguage");
    expect(historySource).toContain('flexWrap: "wrap"');
    expect(historySource).toContain("flexShrink: 1");
    expect(historySource).not.toContain("numberOfLines={1}");
  });

  it("路線頁完整接入核心文案，並保護 RTL 圖示與長字串卡片", () => {
    expect(routeSource).toContain('t("routes.title")');
    expect(routeSource).toContain('t("routes.startNavigation")');
    expect(routeSource).toContain(
      'name={isRTL ? "chevron.left" : "chevron.right"}',
    );
    expect(routeSource).toMatch(
      /weatherHeader:\s*\{[\s\S]*?flexDirection:\s*"row",[\s\S]*?justifyContent:\s*"space-between",[\s\S]*?alignItems:\s*"center",[\s\S]*?flexWrap:\s*"wrap"/,
    );
    expect(routeSource).toMatch(
      /routePreviewHeader:\s*\{[\s\S]*?flexDirection:\s*"row",[\s\S]*?justifyContent:\s*"space-between",[\s\S]*?alignItems:\s*"center",[\s\S]*?flexWrap:\s*"wrap"/,
    );
    expect(routeSource).not.toContain("numberOfLines={1}");
  });

  it("設定表單支援 RTL、長字串與不打斷操作的即時驗證回饋", () => {
    expect(settingsSource).toContain(
      'const isRtl = activeLanguage === "ar-SA"',
    );
    expect(settingsSource).toContain('textAlign: isRtl ? "right" : "left"');
    expect(settingsSource).toContain(
      'flexDirection: isRtl ? "row-reverse" : "row"',
    );
    expect(settingsSource).toContain("editInlineError");
    expect(settingsSource).toContain("supplyNameError");
    expect(settingsSource).toContain("supplyTimeError");
    expect(settingsSource).not.toContain(
      't("settingsActions.clearCacheLabel")',
    );
    expect(settingsSource).toContain('t("settingsActions.resetBody")');
    expect(settingsSource).toContain("flexShrink: 1");
  });

  it("表單長字串依量測結果自動縮小字級，達最小值後改用換行而不截斷", () => {
    expect(adaptiveTextSource).toContain("onTextLayout");
    expect(adaptiveTextSource).toContain("maxLinesBeforeShrink");
    expect(adaptiveTextSource).toContain("minFontScale");
    expect(adaptiveTextSource).toContain('flexWrap: "wrap"');
    expect(adaptiveTextSource).not.toContain("ellipsizeMode");
    expect(settingsSource).toContain("AdaptiveFormText");
    expect(settingsSource).toContain("multiline");
    expect(supplyModalSource).toContain("AdaptiveFormText");
    expect(supplyModalSource).toContain("multiline");
  });

  it("活動與分享內容沿用自適應策略，並保存 130%／200% 多語系截圖 artifact", () => {
    expect(activityDetailSource).toContain("AdaptiveFormText");
    expect(activityDetailSource).toContain("maxLength={90}");
    expect(shareCardSource).toContain("AdaptiveFormText");
    expect(maestroFontScaleGermanSource).toContain(
      'takeScreenshot: "font-scale-settings-de"',
    );
    expect(maestroFontScaleRussianSource).toContain(
      'takeScreenshot: "font-scale-settings-ru"',
    );
    expect(maestroFontScaleArabicSource).toContain(
      'takeScreenshot: "font-scale-settings-ar"',
    );
    expect(maestroFontScaleGermanSource).toContain('text: "Language.*"');
    expect(settingsSource).toContain("testID={`language-option-${option}`}");
    expect(maestroFontScaleGermanSource).toContain(
      "scroll-language-option.yaml",
    );
    expect(workflowSource).toContain("for SCALE in 1.3 2.0");
    expect(workflowSource).toContain(
      'adb -s "$ANDROID_SERIAL" shell settings put system font_scale',
    );
    expect(deviceValidationSource).toContain("130%");
    expect(deviceValidationSource).toContain("200%");
  });
});
