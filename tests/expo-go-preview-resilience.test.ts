import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const devScript = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
const prewarmScript = readFileSync(resolve(process.cwd(), "scripts/prewarm-expo-go-bundle.sh"), "utf8");
const webIconSource = readFileSync(resolve(process.cwd(), "components/ui/icon-symbol.web.tsx"), "utf8");
const readinessSource = readFileSync(resolve(process.cwd(), "components/ride-permission-readiness.tsx"), "utf8");

describe("Expo Go 與管理預覽可用性守門", () => {
  it("預熱 Expo Go 所需的 Android Hermes bundle，避免手機首次掃描遇到冷編譯逾時", () => {
    expect(prewarmScript).toContain("platform=android");
    expect(prewarmScript).toContain("transform.engine=hermes");
    expect(prewarmScript).toContain("transform.bytecode=1");
    expect(prewarmScript).toContain("--max-time 90");
  });

  it("日常管理預覽不依賴 tunnel，Expo Go 預熱保留在獨立指令", () => {
    expect(devScript).toContain('"dev": "pnpm dev:preview"');
    expect(devScript).toContain('"dev:preview"');
    expect(devScript).toContain("expo start --web");
    expect(devScript).toContain('"expo:go"');
    expect(devScript).toContain("expo start --tunnel");
    expect(devScript).toContain("prewarm-expo-go-bundle.sh");
    expect(devScript).not.toContain("expo start --clear");
    expect(devScript).not.toContain("EXPO_NO_INTERACTIVE=1");
  });

  it("Web 預覽使用文字圖示 fallback，不載入 MaterialIcons 字型或 fontfaceobserver", () => {
    expect(webIconSource).toContain("const WEB_GLYPHS");
    expect(webIconSource).toContain('accessibilityRole="image"');
    expect(webIconSource).not.toContain("@expo/vector-icons");
    expect(webIconSource).not.toContain("fontfaceobserver");
    expect(readinessSource).toContain("import { IconSymbol }");
    expect(readinessSource).not.toContain("@expo/vector-icons/MaterialIcons");
  });
});
