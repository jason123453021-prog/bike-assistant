const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Config Plugin: with-audio-boot-receiver-fix
 * 
 * 功能：
 * 1. 移除 expo-audio 自動添加的 BOOT_COMPLETED 廣播接收器
 * 2. 防止在 Android 15+ 上啟動受限制的前景服務
 * 3. 符合 Google Play Console 要求
 */
module.exports = function withAudioBootReceiverFix(config) {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;

    if (!androidManifest.manifest.application) {
      return config;
    }

    const application = androidManifest.manifest.application[0];

    // 移除所有包含 BOOT_COMPLETED 的廣播接收器
    if (application.receiver) {
      application.receiver = application.receiver.filter((receiver) => {
        const intentFilters = receiver["intent-filter"] || [];
        
        // 檢查是否有 BOOT_COMPLETED action
        const hasBootCompleted = intentFilters.some((filter) => {
          const actions = filter.action || [];
          return actions.some(
            (action) => action.$["android:name"] === "android.intent.action.BOOT_COMPLETED"
          );
        });

        // 保留不包含 BOOT_COMPLETED 的接收器
        return !hasBootCompleted;
      });

      // 如果沒有接收器了，刪除 receiver 陣列
      if (application.receiver.length === 0) {
        delete application.receiver;
      }
    }

    return config;
  });
};
