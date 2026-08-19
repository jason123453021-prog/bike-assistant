import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const permissionsSource = readFileSync(resolve(process.cwd(), "lib/permissions-manager.ts"), "utf8");
const configSource = readFileSync(resolve(process.cwd(), "app.config.ts"), "utf8");
const mapSource = readFileSync(resolve(process.cwd(), "app/(tabs)/map.tsx"), "utf8");

describe("移除未使用的懸浮窗與空白互動", () => {
  it("不保留永遠無法驗證的 overlay 權限或 Android 特殊權限", () => {
    expect(permissionsSource).not.toContain("'overlay'");
    expect(permissionsSource).not.toContain("checkOverlayPermission");
    expect(configSource).not.toContain("SYSTEM_ALERT_WINDOW");
  });

  it("觸控鎖定覆蓋層僅使用有效的長按處理器", () => {
    expect(mapSource).not.toContain("onPress={() => {}}");
    expect(mapSource).toContain("onLongPress={() => {");
    expect(mapSource).toContain("completeTouchGuardUnlock()");
  });
});
