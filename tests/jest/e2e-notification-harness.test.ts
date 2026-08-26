import fs from "node:fs";
import path from "node:path";

const rootDir = path.resolve(__dirname, "../..");

describe("E2E 本機通知入口守門", () => {
  it("清除 App 資料後排程通知前仍會啟用補給提醒", () => {
    const source = fs.readFileSync(
      path.join(rootDir, "app/e2e-notification.tsx"),
      "utf8",
    );

    expect(source).toContain(
      'import { useSettings } from "@/lib/settings-context"',
    );
    expect(source).toContain("const { updateSettings } = useSettings()");
    expect(source).toContain("updateSettings({ supplyReminderEnabled: true })");
    expect(
      source.indexOf("updateSettings({ supplyReminderEnabled: true })"),
    ).toBeLessThan(source.indexOf("scheduleNotificationAsync"));
  });
});
