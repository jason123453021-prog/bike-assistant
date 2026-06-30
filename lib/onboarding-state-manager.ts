import AsyncStorage from '@react-native-async-storage/async-storage';

const FIRST_LAUNCH_FLAG = 'app_first_launch_completed';
const PERMISSION_ONBOARDING_SHOWN = 'permission_onboarding_shown';
const LAST_PERMISSION_CHECK = 'last_permission_check';

export interface OnboardingState {
  isFirstLaunch: boolean;
  hasShownPermissionOnboarding: boolean;
  lastPermissionCheckTime: number;
}

/**
 * 首次啟動和權限 Onboarding 狀態管理器
 * 用於控制權限設定頁面的顯示邏輯
 */
export class OnboardingStateManager {
  /**
   * 檢查是否為首次啟動
   */
  static async isFirstLaunch(): Promise<boolean> {
    try {
      const flag = await AsyncStorage.getItem(FIRST_LAUNCH_FLAG);
      return !flag;
    } catch (error) {
      console.error('[OnboardingStateManager] 檢查首次啟動失敗:', error);
      return false;
    }
  }

  /**
   * 標記首次啟動已完成
   */
  static async markFirstLaunchComplete(): Promise<void> {
    try {
      await AsyncStorage.setItem(FIRST_LAUNCH_FLAG, 'true');
      console.log('[OnboardingStateManager] 已標記首次啟動完成');
    } catch (error) {
      console.error('[OnboardingStateManager] 標記首次啟動失敗:', error);
    }
  }

  /**
   * 檢查是否已顯示權限 Onboarding
   */
  static async hasShownPermissionOnboarding(): Promise<boolean> {
    try {
      const flag = await AsyncStorage.getItem(PERMISSION_ONBOARDING_SHOWN);
      return !!flag;
    } catch (error) {
      console.error('[OnboardingStateManager] 檢查權限 Onboarding 失敗:', error);
      return false;
    }
  }

  /**
   * 標記權限 Onboarding 已顯示
   */
  static async markPermissionOnboardingShown(): Promise<void> {
    try {
      await AsyncStorage.setItem(PERMISSION_ONBOARDING_SHOWN, 'true');
      console.log('[OnboardingStateManager] 已標記權限 Onboarding 已顯示');
    } catch (error) {
      console.error('[OnboardingStateManager] 標記權限 Onboarding 失敗:', error);
    }
  }

  /**
   * 獲取最後一次權限檢查的時間戳
   */
  static async getLastPermissionCheckTime(): Promise<number> {
    try {
      const timestamp = await AsyncStorage.getItem(LAST_PERMISSION_CHECK);
      return timestamp ? parseInt(timestamp, 10) : 0;
    } catch (error) {
      console.error('[OnboardingStateManager] 獲取最後權限檢查時間失敗:', error);
      return 0;
    }
  }

  /**
   * 更新最後一次權限檢查的時間戳
   */
  static async updateLastPermissionCheckTime(): Promise<void> {
    try {
      const now = Date.now();
      await AsyncStorage.setItem(LAST_PERMISSION_CHECK, now.toString());
    } catch (error) {
      console.error('[OnboardingStateManager] 更新最後權限檢查時間失敗:', error);
    }
  }

  /**
   * 獲取完整的 Onboarding 狀態
   */
  static async getOnboardingState(): Promise<OnboardingState> {
    try {
      const isFirstLaunch = await this.isFirstLaunch();
      const hasShownPermissionOnboarding =
        await this.hasShownPermissionOnboarding();
      const lastPermissionCheckTime = await this.getLastPermissionCheckTime();

      return {
        isFirstLaunch,
        hasShownPermissionOnboarding,
        lastPermissionCheckTime,
      };
    } catch (error) {
      console.error('[OnboardingStateManager] 獲取 Onboarding 狀態失敗:', error);
      return {
        isFirstLaunch: false,
        hasShownPermissionOnboarding: false,
        lastPermissionCheckTime: 0,
      };
    }
  }

  /**
   * 重置 Onboarding 狀態（用於測試）
   */
  static async resetOnboardingState(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        FIRST_LAUNCH_FLAG,
        PERMISSION_ONBOARDING_SHOWN,
        LAST_PERMISSION_CHECK,
      ]);
      console.log('[OnboardingStateManager] 已重置 Onboarding 狀態');
    } catch (error) {
      console.error('[OnboardingStateManager] 重置 Onboarding 狀態失敗:', error);
    }
  }

  /**
   * 判斷是否應該顯示權限 Onboarding 彈窗
   * 規則：首次啟動 AND 未顯示過 Onboarding
   */
  static async shouldShowPermissionOnboarding(): Promise<boolean> {
    try {
      const state = await this.getOnboardingState();
      return state.isFirstLaunch && !state.hasShownPermissionOnboarding;
    } catch (error) {
      console.error('[OnboardingStateManager] 判斷是否顯示 Onboarding 失敗:', error);
      return false;
    }
  }
}

/**
 * 獲取單例實例
 */
export function getOnboardingStateManager(): typeof OnboardingStateManager {
  return OnboardingStateManager;
}
