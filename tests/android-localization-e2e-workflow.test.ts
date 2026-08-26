import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(process.cwd(), ".github/workflows/android-e2e.yml"),
  "utf8",
);

describe("Android 多語系與大字體 Emulator 驗收 workflow", () => {
  it("保留日文、韓文、Arabic 的逐頁 Maestro 截圖流程", () => {
    expect(workflow).toContain("localization-pages-${LOCALE}.yaml");
    expect(workflow).toContain("for LOCALE in ja ko ar");
    expect(workflow).toContain("maestro-localization-${LOCALE}.xml");
    expect(workflow).toContain("build/maestro-results/localization-${LOCALE}");
  });

  it("在 Arabic locale 已確立後使用獨立流程驗收 200% 系統字體並於結束後還原", () => {
    expect(workflow).toContain("localization-ar-large-text.yaml");
    expect(workflow).toContain("maestro-localization-ar-200.xml");
    expect(workflow).toContain(
      'adb -s "$ANDROID_SERIAL" shell settings put system font_scale 2.0',
    );
    expect(workflow).toContain(
      'adb -s "$ANDROID_SERIAL" shell settings put system font_scale 1.0',
    );
  });

  it("在既有通知驗收前完成多語系截圖，並將 Maestro 呼叫綁定目前 Emulator", () => {
    const localeFlowIndex = workflow.indexOf("for LOCALE in ja ko ar");
    const notificationFlowIndex = workflow.indexOf(
      "e2e/maestro/notification-harness-schedule.yaml",
    );

    expect(workflow).toContain('export ANDROID_SERIAL="$(adb devices');
    expect(workflow).toContain('--device "$ANDROID_SERIAL"');
    expect(localeFlowIndex).toBeGreaterThan(-1);
    expect(notificationFlowIndex).toBeGreaterThan(localeFlowIndex);
  });

  it("將多語系 JUnit 與 screenshots 一併上傳為可追溯 artifact", () => {
    expect(workflow).toContain("build/maestro-localization-*.xml");
    expect(workflow).toContain("build/maestro-results");
    expect(workflow).toContain("bike-assistant-maestro-e2e");
  });
});
