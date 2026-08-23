import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("專業碼表導航安全與高頻渲染邊界", () => {
  it("結束騎乘使用標準二鍵確認，不保留長按 Modal 或延遲計時器", () => {
    const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");

    expect(mapSource).toContain('Alert.alert(\n      "確認結束騎乘"');
    expect(mapSource).toContain('text: "結束並儲存"');
    expect(mapSource).toContain("void finalizeStopRide();");
    expect(mapSource).not.toContain("stopConfirmVisible");
    expect(mapSource).not.toContain("長按確認結束騎乘");
    expect(mapSource).not.toContain("startStopConfirmHold");
  });

  it("保留 Leaflet WebView 局部訊息邊界，並 memo 化高頻儀表格", () => {
    const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");
    const leafletSource = readFileSync(resolve(projectRoot, "components/leaflet-map.tsx"), "utf8");

    expect(mapSource).toContain("const MemoizedDashMetric = React.memo(DashMetric);");
    expect(mapSource).toContain("<MemoizedDashMetric");
    expect(leafletSource).toContain("React.memo");
    expect(leafletSource).toContain("postMessage");
  });
});
