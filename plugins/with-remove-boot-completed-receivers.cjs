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

const RECEIVER_ACTIONS = {
  "expo.modules.notifications.service.NotificationsService": [
    "expo.modules.notifications.NOTIFICATION_EVENT",
    "android.intent.action.MY_PACKAGE_REPLACED",
  ],
  "expo.modules.taskManager.TaskBroadcastReceiver": [
    "expo.modules.taskManager.TaskBroadcastReceiver.INTENT_ACTION",
    "android.intent.action.MY_PACKAGE_REPLACED",
  ],
};

function createReceiverOverride(name) {
  return {
    $: {
      "android:name": name,
      "android:enabled": "true",
      "android:exported": "false",
      // intent-filter elements never match by default, so this high-priority receiver
      // must replace the lower-priority library receiver as a whole.
      "tools:node": "replace",
    },
    "intent-filter": [
      {
        $: { "android:priority": "-1" },
        action: RECEIVER_ACTIONS[name].map((action) => ({
          $: { "android:name": action },
        })),
      },
    ],
  };
}

function removeBootCompletedActions(androidManifest) {
  const manifest = androidManifest?.manifest;
  const application = manifest?.application?.[0];
  if (!manifest || !application) return androidManifest;

  manifest.$ = {
    ...(manifest.$ ?? {}),
    "xmlns:tools": "http://schemas.android.com/tools",
  };

  const untouchedReceivers = (application.receiver ?? []).filter(
    (receiver) => !TARGET_RECEIVERS.has(receiver?.$?.["android:name"]),
  );

  application.receiver = [
    ...untouchedReceivers,
    ...[...TARGET_RECEIVERS].map(createReceiverOverride),
  ];

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
