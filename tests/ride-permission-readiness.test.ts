import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readinessSource = readFileSync(resolve(process.cwd(), 'components/ride-permission-readiness.tsx'), 'utf8');
const managerSource = readFileSync(resolve(process.cwd(), 'lib/permissions-manager.ts'), 'utf8');
const settingsSource = readFileSync(resolve(process.cwd(), 'app/(tabs)/settings.tsx'), 'utf8');
const mapSource = readFileSync(resolve(process.cwd(), 'app/(tabs)/map.tsx'), 'utf8');

describe('正式 APK 背景騎乘權限健檢', () => {
  it('provides separate notification, background location and battery guidance', () => {
    expect(readinessSource).toContain('補給與導航通知');
    expect(readinessSource).toContain('精確與背景位置');
    expect(readinessSource).toContain('電池不受限制');
    expect(readinessSource).toContain('PermissionsManager.requestNotificationPermission');
    expect(readinessSource).toContain('PermissionsManager.requestLocationPermission');
    expect(settingsSource).toContain('<RidePermissionReadiness />');
  });

  it('uses Expo official Android intents instead of hard-coded third-party settings URLs', () => {
    expect(managerSource).toContain("import * as IntentLauncher from 'expo-intent-launcher'");
    expect(managerSource).toContain('ActivityAction.APP_NOTIFICATION_SETTINGS');
    expect(managerSource).toContain('ActivityAction.APPLICATION_DETAILS_SETTINGS');
    expect(managerSource).toContain('ActivityAction.IGNORE_BATTERY_OPTIMIZATION_SETTINGS');
    expect(managerSource).not.toContain('com.jason123453021.bikeassistant');
  });

  it('removes the readiness hint from the pre-ride controls', () => {
    expect(mapSource).not.toContain('開始前請確認通知、背景位置與電池不受限制');
    expect(mapSource).not.toContain('router.push("/settings")');
  });
});
