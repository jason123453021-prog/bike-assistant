const {
  createRunOncePlugin,
  withAndroidManifest,
} = require("@expo/config-plugins");

/**
 * App 只會由使用者主動開始騎乘時啟動 location 前景服務。
 * 移除 Expo Notifications／Task Manager 接收器的開機 action，可避免 Android 15+
 * 將開機 broadcast 與受限制 FGS（特別是套件提供的 mediaPlayback service）關聯。
 * 保留應用程式內的通知與 Task Manager action，不會移除日常本機提醒功能。
 */
const BOOT_ACTIONS = new Set([
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.REBOOT",
  "android.intent.action.QUICKBOOT_POWERON",
  "com.htc.intent.action.QUICKBOOT_POWERON",
]);

const TARGET_RECEIVERS = new Set([
  "expo.modules.notifications.service.NotificationsService",
  "expo.modules.taskManager.TaskBroadcastReceiver",
]);

function removeBootCompletedActions(androidManifest) {
  const application = androidManifest?.manifest?.application?.[0];
  const receivers = application?.receiver ?? [];

  receivers
    .filter((receiver) => TARGET_RECEIVERS.has(receiver?.$?.["android:name"]))
    .forEach((receiver) => {
      receiver["intent-filter"] = (receiver["intent-filter"] ?? [])
        .map((intentFilter) => ({
          ...intentFilter,
          action: (intentFilter.action ?? []).filter(
            (action) => !BOOT_ACTIONS.has(action?.$?.["android:name"]),
          ),
        }))
        .filter((intentFilter) => (intentFilter.action ?? []).length > 0);
    });

  return androidManifest;
}

function withRemoveBootCompletedReceivers(config) {
  return withAndroidManifest(config, (modConfig) => {
    modConfig.modResults = removeBootCompletedActions(modConfig.modResults);
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withRemoveBootCompletedReceivers,
  "bike-assistant-remove-boot-completed-receivers",
  "1.0.0",
);
module.exports.BOOT_ACTIONS = BOOT_ACTIONS;
module.exports.removeBootCompletedActions = removeBootCompletedActions;
