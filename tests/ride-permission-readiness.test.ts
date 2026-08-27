import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readinessSource = readFileSync(
  resolve(process.cwd(), "components/ride-permission-readiness.tsx"),
  "utf8",
);
const managerSource = readFileSync(
  resolve(process.cwd(), "lib/permissions-manager.ts"),
  "utf8",
);
const settingsSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/settings.tsx"),
  "utf8",
);
const mapSource = readFileSync(
  resolve(process.cwd(), "app/(tabs)/map.tsx"),
  "utf8",
);
const disclosureSource = readFileSync(
  resolve(process.cwd(), "components/background-location-disclosure.tsx"),
  "utf8",
);
const disclosureStateSource = readFileSync(
  resolve(process.cwd(), "lib/background-location-disclosure.ts"),
  "utf8",
);
const translationsSource = readFileSync(
  resolve(process.cwd(), "lib/i18n/permission-translations.ts"),
  "utf8",
);

describe("正式 APK 背景騎乘權限健檢", () => {
  it("provides separate notification, background location and battery guidance", () => {
    expect(readinessSource).toContain("permissions.notifications");
    expect(readinessSource).toContain("permissions.location");
    expect(readinessSource).toContain("permissions.battery");
    expect(readinessSource).toContain("useTranslation");
    expect(readinessSource).toContain(
      "PermissionsManager.requestNotificationPermission",
    );
    expect(readinessSource).toContain(
      "PermissionsManager.requestLocationPermission",
    );
    expect(settingsSource).toContain("<RidePermissionReadiness />");
  });

  it("uses Expo official Android intents instead of hard-coded third-party settings URLs", () => {
    expect(managerSource).toContain(
      "import * as IntentLauncher from 'expo-intent-launcher'",
    );
    expect(managerSource).toContain("ActivityAction.APP_NOTIFICATION_SETTINGS");
    expect(managerSource).toContain(
      "ActivityAction.APPLICATION_DETAILS_SETTINGS",
    );
    expect(managerSource).toContain(
      "ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS",
    );
    expect(managerSource).not.toContain("com.jason123453021.bikeassistant");
  });

  it("treats battery optimization as a manual system confirmation instead of permanently reporting a false denial", () => {
    expect(managerSource).toContain("verification: 'manual'");
    expect(managerSource).toContain("required: false");
    expect(readinessSource).toMatch(
      /const isManualVerification\s*=\s*status\?\.verification === "manual";/,
    );
    expect(readinessSource).not.toContain(
      "item.type === 'battery_optimization' ? false",
    );
  });

  it("removes the readiness hint from the pre-ride controls", () => {
    expect(mapSource).not.toContain("開始前請確認通知、背景位置與電池不受限制");
    expect(mapSource).not.toContain('router.push("/settings")');
  });

  it("shows an in-app prominent disclosure before requesting background location", () => {
    expect(disclosureSource).toContain(
      "permissions.backgroundDisclosurePurpose",
    );
    expect(disclosureSource).toContain("permissions.backgroundDisclosureData");
    expect(disclosureSource).toContain("permissions.backgroundDisclosureStop");
    expect(disclosureSource).toContain(
      "permissions.backgroundDisclosureSystem",
    );
    expect(disclosureSource).toContain(
      "permissions.backgroundDisclosureNotNow",
    );
    expect(disclosureSource).toContain(
      "permissions.backgroundDisclosureContinue",
    );
    expect(disclosureStateSource).toContain(
      "BACKGROUND_LOCATION_DISCLOSURE_STORAGE_KEY",
    );
    expect(mapSource).toContain("await requestBackgroundLocationDisclosure()");
    expect(mapSource).toContain("<BackgroundLocationDisclosure");
    expect(readinessSource).toContain("requestLocationWithDisclosure");
    expect(readinessSource).toContain("<BackgroundLocationDisclosure");
  });

  it("keeps every supported locale's disclosure copy together with permission text", () => {
    expect(
      translationsSource.match(/backgroundDisclosureTitle:/g) ?? [],
    ).toHaveLength(13);
    expect(
      translationsSource.match(/backgroundDisclosureContinue:/g) ?? [],
    ).toHaveLength(13);
  });
});
