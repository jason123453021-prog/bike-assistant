import fs from "node:fs";
import path from "node:path";

import i18n from "../../lib/i18n/i18n";
import { createLocalizedExportFilename } from "../../lib/i18n/export-localization";
import type { RideRecord } from "../../lib/ride-context";

const rootDir = path.resolve(__dirname, "../..");
const record = { id: "locale-export", name: "Morning Climb", date: Date.UTC(2026, 7, 25), route: [] } as unknown as RideRecord;

describe("通知、匯出檔名與單車術語 i18n 守門", () => {
  afterEach(async () => { await i18n.changeLanguage("zh-TW"); });

  it("會依目前 locale 產生安全的 GPX、FIT、SVG 檔名", async () => {
    await i18n.changeLanguage("en-US");
    expect(createLocalizedExportFilename(record, "gpx")).toMatch(/^activity-Morning-Climb-\d{4}-\d{2}-\d{2}\.gpx$/);
    expect(createLocalizedExportFilename(record, "fit")).toContain("activity-Morning-Climb");
    await i18n.changeLanguage("zh-TW");
    expect(createLocalizedExportFilename(record, "svg")).toMatch(/^分享卡片-Morning-Climb-\d{4}-\d{2}-\d{2}\.svg$/);
  });

  it("核心術語在英語與繁中使用一致、專業的活動資料名稱", async () => {
    await i18n.changeLanguage("en-US");
    expect(i18n.t("share.movingTime")).toBe("Moving Time");
    expect(i18n.t("share.elevation")).toBe("Elevation Gain");
    expect(i18n.t("detail.avgCadence")).toBe("Avg Cadence");
    await i18n.changeLanguage("zh-TW");
    expect(i18n.t("share.movingTime")).toBe("移動時間");
    expect(i18n.t("share.elevation")).toBe("總爬升");
    expect(i18n.t("detail.avgCadence")).toBe("平均踏頻");
  });

  it("活動通知、供給 action 與三種輸出器均透過語系化服務取得文案或檔名", () => {
    const feedback = fs.readFileSync(path.join(rootDir, "lib/feedback-service.ts"), "utf8");
    const actions = fs.readFileSync(path.join(rootDir, "lib/supply-notification-actions.ts"), "utf8");
    const background = fs.readFileSync(path.join(rootDir, "lib/background-location.ts"), "utf8");
    const gpx = fs.readFileSync(path.join(rootDir, "lib/gpx-export.ts"), "utf8");
    const fit = fs.readFileSync(path.join(rootDir, "lib/fit-export.ts"), "utf8");
    const svg = fs.readFileSync(path.join(rootDir, "lib/ride-share-card-svg.ts"), "utf8");
    expect(feedback).toContain("createLocalizedSupplyNotificationContent");
    expect(actions).toContain('exportTranslation("notifications.confirm")');
    expect(background).toContain("createLocalizedSupplyNotificationContent");
    for (const source of [gpx, fit, svg]) expect(source).toContain("createLocalizedExportFilename");
  });
});
