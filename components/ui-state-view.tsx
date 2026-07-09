import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';
import { UIStateConfig } from '@/lib/ui-state-manager';

interface UIStateViewProps {
  state: UIStateConfig;
  onRetry?: () => void;
  children?: React.ReactNode;
}

export function UIStateView({ state, onRetry, children }: UIStateViewProps) {
  const colors = useColors();

  if (state.state === 'loading') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.message, { color: colors.muted }]}>{state.message}</Text>
      </View>
    );
  }

  if (state.state === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorIcon]}>⚠️</Text>
        <Text style={[styles.errorTitle, { color: colors.error }]}>出錯了</Text>
        <Text style={[styles.errorMessage, { color: colors.muted }]}>{state.error}</Text>
        {state.retryable && onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            style={[styles.retryButton, { backgroundColor: colors.primary + '20' }]}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>🔄 重試</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (state.state === 'empty') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyIcon]}>📭</Text>
        <Text style={[styles.emptyMessage, { color: colors.muted }]}>{state.message}</Text>
      </View>
    );
  }

  if (state.state === 'success' || state.state === 'idle') {
    return <>{children}</>;
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  message: {
    fontSize: 14,
    marginTop: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyMessage: {
    fontSize: 14,
    textAlign: 'center',
  },
});
