import { Component, type ErrorInfo, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
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
        <SafeAreaView style={styles.safeArea} edges={["top", "bottom", "left", "right"]}>
          <View style={styles.content}>
            <Text accessibilityRole="header" style={styles.title}>暫時無法顯示此畫面</Text>
            <Text style={styles.body}>
              目前騎乘資料已保留在本機。請先嘗試重新開啟此畫面；若問題持續，請重新啟動單車助手。
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="重新嘗試顯示畫面"
              onPress={this.retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.retryButtonPressed]}
            >
              <Text style={styles.retryButtonText}>重新嘗試</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return <View key={this.state.recoveryKey} style={styles.fill}>{this.props.children}</View>;
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
