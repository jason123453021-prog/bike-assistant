import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);

describe("POI 預覽圖記憶體保護", () => {
  it("以 Expo Image 在顯示尺寸預先縮放，並採磁碟快取而非常駐記憶體快取", () => {
    expect(mapSource).toContain('import { Image } from "expo-image"');
    expect(mapSource).toContain("allowDownscaling");
    expect(mapSource).toContain("enforceEarlyResizing");
    expect(mapSource).toContain('cachePolicy="disk"');
    expect(mapSource).toContain('contentFit="cover"');
    expect(mapSource).toContain("recyclingKey={selectedPoi.id}");
  });
});
