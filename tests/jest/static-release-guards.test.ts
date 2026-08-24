import fs from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();

function collectSourceFiles(relativeDirectory: string): string[] {
  const directory = path.join(projectRoot, relativeDirectory);
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(relativePath);
    return /\.(ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });
}

function readProductionSource(): string {
  return ["app", "components", "lib"]
    .flatMap(collectSourceFiles)
    .map((file) => fs.readFileSync(path.join(projectRoot, file), "utf8"))
    .join("\n/* STATIC_GUARD_FILE_BOUNDARY */\n");
}

describe("封版靜態防回歸守門", () => {
  const productionSource = readProductionSource();
  const fitExportSource = fs.readFileSync(path.join(projectRoot, "lib/fit-export.ts"), "utf8");
  const gpxExportSource = fs.readFileSync(path.join(projectRoot, "lib/gpx-export.ts"), "utf8");

  it("產品程式碼不包含手動 Lap UI 或處理流程", () => {
    expect(productionSource).not.toMatch(/handleManualLap|createManualLap|manual\s*lap|手動\s*計圈/i);
  });

  it("產品程式碼不包含日出／日落提醒或排程，僅允許設定遷移時忽略舊欄位", () => {
    const withoutLegacySettingsMigration = productionSource.replace(
      /\s*daylightAlertEnabled:\s*_legacyDaylightAlertEnabled,\s*\n\s*daylightAlertLeadMinutes:\s*_legacyDaylightAlertLeadMinutes,\s*\n\s*daylightAlertMode:\s*_legacyDaylightAlertMode,?/g,
      "",
    );
    expect(withoutLegacySettingsMigration).not.toMatch(/daylightAlert|sunrise|sunset|日出提醒|日落提醒/i);
  });

  it("產品程式碼不導入 Kalman Filter，僅使用可追溯的品質閘門與平滑資料鏈", () => {
    expect(productionSource).not.toMatch(/kalman/i);
    expect(productionSource).toContain("live-elevation-filter");
  });

  it("FIT 的 totalTimerTime 僅綁定 movingTime；GPX 保留原始點時間戳", () => {
    expect(fitExportSource).toContain("const totalTimerTime = Math.max(0, record.movingTime ?? record.duration - record.totalPausedSec);");
    expect(fitExportSource).toContain("totalElapsedTime: Math.max(0, record.duration)");
    expect(gpxExportSource).toMatch(/point\.timestamp/);
  });
});
