/**
 * 全域錯誤邊界
 * 捕捉應用程式級別的錯誤，防止完全崩潰
 */

import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    this.setState({
      error,
      errorInfo: errorInfo.componentStack || '',
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: '',
    });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const colors = useColors();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 16,
        }}
      >
        <View style={{ alignItems: 'center' }}>
          <Text
            style={{
              fontSize: 24,
              fontWeight: 'bold',
              color: colors.error,
              marginBottom: 16,
            }}
          >
            應用程式發生錯誤
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: 8,
              padding: 16,
              marginBottom: 16,
              width: '100%',
            }}
          >
            <Text
              style={{
                fontSize: 14,
                color: colors.foreground,
                fontWeight: 'bold',
                marginBottom: 8,
              }}
            >
              錯誤信息：
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: colors.muted,
                fontFamily: 'monospace',
              }}
            >
              {error?.message || '未知錯誤'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onReset}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: colors.background,
                fontWeight: 'bold',
                fontSize: 16,
              }}
            >
              重新啟動應用程式
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
