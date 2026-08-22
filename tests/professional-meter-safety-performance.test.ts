import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(__dirname, "..");

describe("專業碼表導航安全與高頻渲染邊界", () => {
  it("結束騎乘必須先進入長按二次確認，不保留單次 Alert 結束入口", () => {
    const mapSource = readFileSync(resolve(projectRoot, "app/(tabs)/map.tsx"), "utf8");

    expect(mapSource).toContain("const [stopConfirmVisible, setStopConfirmVisible] = useState(false);");
    expect(mapSource).toContain("accessibilityLabel=\"長按確認結束騎乘\"");
    expect(mapSource).toContain("onPressIn={startStopConfirmHold}");
    expect(mapSource).toContain("onPressOut={clearStopConfirmHold}");
    expect(mapSource).toContain("}, 1_200);");
    expect(mapSource).not.toContain('Alert.alert("結束騎乘"');
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
