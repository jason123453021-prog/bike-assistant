import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { Redirect } from "expo-router";

import { AdaptiveFormText } from "@/components/adaptive-form-text";
import { ScreenContainer } from "@/components/screen-container";
import {
  requestNotificationPermission,
  setupNotifications,
} from "@/lib/feedback-service";
import { getLocalNotifications } from "@/lib/local-notifications";
import {
  configureSupplyNotificationActions,
  SUPPLY_NOTIFICATION_CATEGORY,
} from "@/lib/supply-notification-actions";

const E2E_NOTIFICATION_HARNESS_ENABLED =
  Constants.expoConfig?.extra?.e2eNotificationHarness === true;

export default function E2ENotificationScreen() {
  const [status, setStatus] = useState(
    "Ready to schedule a local Android notification.",
  );

  if (!E2E_NOTIFICATION_HARNESS_ENABLED) return <Redirect href="/navigate" />;

  const scheduleNotification = async () => {
    try {
      const Notifications = await getLocalNotifications();
      if (!Notifications) {
        setStatus(
          "Native local notifications are unavailable in this runtime.",
        );
        return;
      }
      await setupNotifications();
      const granted = await requestNotificationPermission();
      if (!granted) {
        setStatus("Notification permission is required for this validation.");
        return;
      }
      await configureSupplyNotificationActions();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "E2E Fuel reminder",
          body: "Tap this notification to restore the pending fuel confirmation.",
          categoryIdentifier: SUPPLY_NOTIFICATION_CATEGORY,
          data: {
            type: "supply_reminder",
            supplyKind: "calorie",
            e2eValidation: true,
          },
          sound: false,
          channelId: "supply",
        } as never,
        trigger: { seconds: 5 } as never,
      });
      setStatus(
        "Notification scheduled. The test will background the app and tap it after five seconds.",
      );
    } catch (error) {
      setStatus(
        `Notification scheduling failed: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }
  };

  return (
    <ScreenContainer className="p-6" edges={["top", "bottom", "left", "right"]}>
      <View style={styles.container}>
        <AdaptiveFormText
          baseFontSize={24}
          maxLinesBeforeShrink={2}
          style={styles.title}
        >
          E2E notification validation
        </AdaptiveFormText>
        <AdaptiveFormText
          baseFontSize={16}
          maxLinesBeforeShrink={3}
          style={styles.body}
        >
          This screen exists only in the GitHub Android Emulator build. It uses
          the production local-notification category and response listener.
        </AdaptiveFormText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Schedule fuel notification"
          onPress={() => {
            void scheduleNotification();
          }}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <AdaptiveFormText baseFontSize={16} style={styles.buttonText}>
            Schedule fuel notification
          </AdaptiveFormText>
        </Pressable>
        <AdaptiveFormText
          baseFontSize={14}
          maxLinesBeforeShrink={4}
          style={styles.status}
        >
          {status}
        </AdaptiveFormText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 20 },
  title: {
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    lineHeight: 31,
  },
  body: { color: "#475569", textAlign: "center", lineHeight: 23 },
  button: {
    minHeight: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0A7EA4",
    paddingHorizontal: 18,
  },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  buttonText: { color: "#FFFFFF", fontWeight: "800", textAlign: "center" },
  status: { color: "#334155", textAlign: "center", lineHeight: 21 },
});
