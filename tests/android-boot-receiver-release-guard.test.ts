import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const configSource = readFileSync(
  resolve(process.cwd(), "app.config.ts"),
  "utf8",
);
const workflowSource = readFileSync(
  resolve(process.cwd(), ".github/workflows/google-play-aab.yml"),
  "utf8",
);
// CommonJS export is intentional because Expo loads config plugins in Node.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { removeBootCompletedActions } = require(
  resolve(process.cwd(), "plugins/with-remove-boot-completed-receivers.cjs"),
) as {
  removeBootCompletedActions: (manifest: unknown) => unknown;
};

const BOOT_ACTIONS = [
  "android.intent.action.BOOT_COMPLETED",
  "android.intent.action.REBOOT",
  "android.intent.action.QUICKBOOT_POWERON",
  "com.htc.intent.action.QUICKBOOT_POWERON",
];

function buildManifestFixture() {
  return {
    manifest: {
      $: {},
      application: [
        {
          receiver: [
            {
              $: {
                "android:name":
                  "expo.modules.notifications.service.NotificationsService",
              },
              "intent-filter": [
                {
                  action: [
                    {
                      $: {
                        "android:name":
                          "expo.modules.notifications.NOTIFICATION_EVENT",
                      },
                    },
                    ...BOOT_ACTIONS.map((name) => ({
                      $: { "android:name": name },
                    })),
                  ],
                },
              ],
            },
            {
              $: {
                "android:name":
                  "expo.modules.taskManager.TaskBroadcastReceiver",
              },
              "intent-filter": [
                {
                  action: [
                    {
                      $: {
                        "android:name":
                          "expo.modules.taskManager.TaskBroadcastReceiver.INTENT_ACTION",
                      },
                    },
                    {
                      $: {
                        "android:name": "android.intent.action.BOOT_COMPLETED",
                      },
                    },
                  ],
                },
              ],
            },
            {
              $: { "android:name": "example.UnrelatedReceiver" },
              "intent-filter": [
                {
                  action: [
                    {
                      $: {
                        "android:name": "android.intent.action.BOOT_COMPLETED",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function receiverActions(
  manifest: ReturnType<typeof buildManifestFixture>,
  name: string,
) {
  const receiver = manifest.manifest.application[0].receiver.find(
    (entry) => entry.$["android:name"] === name,
  );
  return receiver?.["intent-filter"]?.flatMap((intentFilter) =>
    intentFilter.action.map((action) => action.$["android:name"]),
  );
}

describe("Android 15 BOOT_COMPLETED release guard", () => {
  it("applies a final manifest plugin after Expo plugins and keeps RECEIVE_BOOT_COMPLETED blocked", () => {
    expect(configSource).toContain(
      '"./plugins/with-remove-boot-completed-receivers.cjs"',
    );
    expect(configSource).toContain(
      '"android.permission.RECEIVE_BOOT_COMPLETED"',
    );
    expect(workflowSource).toContain("驗證 Android 15 前景服務開機限制");
    expect(workflowSource).toContain("驗證封裝 AAB 未含受限制開機 action");
    expect(workflowSource).toContain("BOOT_COMPLETED|REBOOT|QUICKBOOT_POWERON");
    expect(workflowSource).toContain(
      "android.permission.FOREGROUND_SERVICE_LOCATION",
    );
  });

  it("removes boot actions from Expo notification and task receivers while preserving app-internal events", () => {
    const manifest = buildManifestFixture();
    removeBootCompletedActions(manifest);

    const notificationActions = receiverActions(
      manifest,
      "expo.modules.notifications.service.NotificationsService",
    );
    const taskActions = receiverActions(
      manifest,
      "expo.modules.taskManager.TaskBroadcastReceiver",
    );

    expect(notificationActions).toEqual([
      "expo.modules.notifications.NOTIFICATION_EVENT",
      "android.intent.action.MY_PACKAGE_REPLACED",
    ]);
    expect(taskActions).toEqual([
      "expo.modules.taskManager.TaskBroadcastReceiver.INTENT_ACTION",
      "android.intent.action.MY_PACKAGE_REPLACED",
    ]);
    expect(
      BOOT_ACTIONS.some((action) => notificationActions?.includes(action)),
    ).toBe(false);
    expect(BOOT_ACTIONS.some((action) => taskActions?.includes(action))).toBe(
      false,
    );
  });

  it("does not mutate unrelated receiver declarations", () => {
    const manifest = buildManifestFixture();
    removeBootCompletedActions(manifest);

    expect(receiverActions(manifest, "example.UnrelatedReceiver")).toEqual([
      "android.intent.action.BOOT_COMPLETED",
    ]);
  });

  it("uses a high-priority receiver replacement because library intent filters otherwise merge as unique elements", () => {
    const manifest = buildManifestFixture();
    removeBootCompletedActions(manifest);

    expect(manifest.manifest.$).toMatchObject({
      "xmlns:tools": "http://schemas.android.com/tools",
    });
    const notificationReceiver = manifest.manifest.application[0].receiver.find(
      (entry) =>
        entry.$["android:name"] ===
        "expo.modules.notifications.service.NotificationsService",
    );
    const taskReceiver = manifest.manifest.application[0].receiver.find(
      (entry) =>
        entry.$["android:name"] ===
        "expo.modules.taskManager.TaskBroadcastReceiver",
    );
    expect(
      (notificationReceiver?.$ as Record<string, string>)["tools:node"],
    ).toBe("replace");
    expect((taskReceiver?.$ as Record<string, string>)["tools:node"]).toBe(
      "replace",
    );
  });
});
