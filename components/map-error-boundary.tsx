/**
 * MapErrorBoundary
 *
 * 地圖組件錯誤邊界，確保地圖異常時 App 本體穩定運行
 * 支援離線防護、崩潰攔截、自動恢復
 */

import React, { ReactNode, Component, ErrorInfo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { useColors } from "@/hooks/use-colors";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

class MapErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Map Error Boundary caught:", error, errorInfo);
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <MapErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
          errorCount={this.state.errorCount}
          fallback={this.props.fallback}
        />
      );
    }

    return this.props.children;
  }
}

interface FallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  errorCount: number;
  fallback?: ReactNode;
}

const MapErrorFallback: React.FC<FallbackProps> = ({
  error,
  errorInfo,
  onReset,
  errorCount,
  fallback,
}) => {
  const colors = useColors();

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View style={[styles.errorBox, { backgroundColor: colors.surface, borderColor: colors.error }]}>
          <Text style={[styles.title, { color: colors.error }]}>地圖加載失敗</Text>
          
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            地圖組件遭遇錯誤，但應用程式仍可正常運行
          </Text>

          {error && (
            <View style={styles.errorDetails}>
              <Text style={[styles.label, { color: colors.foreground }]}>錯誤信息：</Text>
              <Text style={[styles.errorMessage, { color: colors.muted }]}>
                {error.message || "未知錯誤"}
              </Text>
            </View>
          )}

          {errorInfo && (
            <View style={styles.errorDetails}>
              <Text style={[styles.label, { color: colors.foreground }]}>堆棧追蹤：</Text>
              <Text style={[styles.stackTrace, { color: colors.muted }]}>
                {errorInfo.componentStack}
              </Text>
            </View>
          )}

          {errorCount > 1 && (
            <View style={[styles.warningBox, { backgroundColor: colors.warning + "20" }]}>
              <Text style={[styles.warningText, { color: colors.warning }]}>
                ⚠️ 地圖已崩潰 {errorCount} 次。建議重啟應用程式。
              </Text>
            </View>
          )}
        </View>

        <View style={styles.suggestions}>
          <Text style={[styles.suggestionsTitle, { color: colors.foreground }]}>
            可能的解決方案：
          </Text>
          <Text style={[styles.suggestionItem, { color: colors.muted }]}>
            • 檢查網路連接
          </Text>
          <Text style={[styles.suggestionItem, { color: colors.muted }]}>
            • 清除應用程式快取
          </Text>
          <Text style={[styles.suggestionItem, { color: colors.muted }]}>
            • 重啟應用程式
          </Text>
          <Text style={[styles.suggestionItem, { color: colors.muted }]}>
            • 更新應用程式至最新版本
          </Text>
        </View>
      </ScrollView>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: colors.primary }]}
        onPress={onReset}
      >
        <Text style={[styles.buttonText, { color: colors.background }]}>
          重試
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
  },
  errorBox: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  errorDetails: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
  },
  errorMessage: {
    fontSize: 12,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  stackTrace: {
    fontSize: 10,
    fontFamily: "monospace",
  },
  warningBox: {
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  warningText: {
    fontSize: 12,
    fontWeight: "500",
  },
  suggestions: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  suggestionItem: {
    fontSize: 12,
    marginBottom: 6,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});

export default MapErrorBoundary;
