import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import i18n from "@/lib/i18n/i18n";

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
  recoveryKey: number;
};

/**
 * Catches otherwise unhandled render errors at the app boundary.
 * The fallback deliberately avoids rendering technical exception content so that
 * a release build does not expose internal implementation details to riders.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
    recoveryKey: 0,
  };

  static getDerivedStateFromError(): Pick<AppErrorBoundaryState, "hasError"> {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    // Intentionally do not log exception details in release builds.
  }

  private retry = () => {
    this.setState((current) => ({
      hasError: false,
      recoveryKey: current.recoveryKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView
          style={styles.safeArea}
          edges={["top", "bottom", "left", "right"]}
        >
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>
              {i18n.t("audit.errorTitle")}
            </Text>
            <Text style={styles.body}>{i18n.t("audit.errorDescription")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={i18n.t("audit.retry")}
              onPress={this.retry}
              style={({ pressed }) => [
                styles.retryButton,
                pressed && styles.retryButtonPressed,
              ]}
            >
              <Text style={styles.retryButtonText}>
                {i18n.t("audit.retry")}
              </Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <View key={this.state.recoveryKey} style={styles.fill}>
        {this.props.children}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#101512",
  },
  fill: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  title: {
    color: "#F4F8F5",
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 32,
    textAlign: "center",
  },
  body: {
    color: "#D1DDD5",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  retryButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#35D39B",
    borderRadius: 14,
    marginTop: 8,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  retryButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  retryButtonText: {
    color: "#05261A",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
});
