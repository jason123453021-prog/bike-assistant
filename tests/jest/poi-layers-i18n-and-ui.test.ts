import fs from "node:fs";
import path from "node:path";

import { SUPPORTED_LOCALES } from "../../lib/i18n/i18n";

const localeDirectory = path.resolve(__dirname, "../../lib/i18n/locales");
const mapSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/map.tsx"),
  "utf8",
);
const settingsSource = fs.readFileSync(
  path.resolve(__dirname, "../../app/(tabs)/settings.tsx"),
  "utf8",
);
const leafletSource = fs.readFileSync(
  path.resolve(__dirname, "../../components/leaflet-map.tsx"),
  "utf8",
);
const poiMaestroFlow = fs.readFileSync(
  path.resolve(__dirname, "../../e2e/maestro/poi-layers-settings.yaml"),
  "utf8",
);
const androidE2eWorkflow = fs.readFileSync(
  path.resolve(__dirname, "../../.github/workflows/android-e2e.yml"),
  "utf8",
);

function flattenValues(source: Record<string, unknown>, prefix = ""): Record<string, string> {
  return Object.entries(source).reduce<Record<string, string>>((result, [key, value]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[nextKey] = value;
    else if (value && typeof value === "object") {
      Object.assign(result, flattenValues(value as Record<string, unknown>, nextKey));
    }
    return result;
  }, {});
}

describe("POI 圖層的全語系與地圖整合", () => {
  const english = JSON.parse(
    fs.readFileSync(path.join(localeDirectory, "en-US.json"), "utf8"),
  ).poiLayers as Record<string, unknown>;
  const englishValues = flattenValues(english);

  it.each(SUPPORTED_LOCALES)("%s 具有 POI 圖層的直接翻譯鍵與插值", (locale) => {
    const localized = JSON.parse(
      fs.readFileSync(path.join(localeDirectory, `${locale}.json`), "utf8"),
    ).poiLayers as Record<string, unknown>;
    const localizedValues = flattenValues(localized);

    expect(Object.keys(localizedValues).sort()).toEqual(
      Object.keys(englishValues).sort(),
    );
    for (const [key, englishValue] of Object.entries(englishValues)) {
      expect(localizedValues[key]).toBeTruthy();
      expect(localizedValues[key].match(/{{\s*[^}\s]+\s*}}/g) ?? []).toEqual(
        englishValue.match(/{{\s*[^}\s]+\s*}}/g) ?? [],
      );
    }
  });

  it("在設定頁提供持久化的兩個圖層開關，不新增地圖控制按鈕", () => {
    expect(settingsSource).toContain('testID="settings-water-refill-layer-toggle"');
    expect(settingsSource).toContain('testID="settings-photo-scenic-layer-toggle"');
    expect(settingsSource).toContain("updateSettings({ showWaterRefillSpots })");
    expect(settingsSource).toContain("updateSettings({ showPhotoScenicSpots })");
    expect(mapSource).not.toContain("settings-water-refill-layer-toggle");
    expect(mapSource).not.toContain("settings-photo-scenic-layer-toggle");
  });

  it("以 Leaflet 聚合呈現 POI，點擊後開啟資訊卡並交給既有釘選導航流程", () => {
    expect(leafletSource).toContain("setPoiMarkers");
    expect(leafletSource).toContain("renderPoiMarkers");
    expect(leafletSource).toContain("shouldClusterPoiMarkers");
    expect(leafletSource).toContain("poiMarkerPress");
    expect(mapSource).toContain('testID="poi-info-sheet"');
    expect(mapSource).toContain('testID="poi-pin-destination"');
    expect(mapSource).toContain("setPinnedLocation({");
    expect(mapSource).toContain("setShowPinCard(true)");
  });

  it("在 Android Emulator 以獨立 Maestro flow 驗證 POI 設定開關", () => {
    expect(poiMaestroFlow).toContain("settings-water-refill-layer-toggle");
    expect(poiMaestroFlow).toContain("settings-photo-scenic-layer-toggle");
    expect(poiMaestroFlow).toContain("poi-layer-map-without-extra-controls");
    expect(androidE2eWorkflow).toContain("e2e/maestro/poi-layers-settings.yaml");
    expect(androidE2eWorkflow).toContain("build/maestro-poi-layers.xml");
  });
});
