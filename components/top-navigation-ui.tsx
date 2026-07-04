import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface TopNavigationUIProps {
  isNavigating: boolean;
  turnInstruction?: string; // 轉彎指令
  remainingDistance?: number; // 剩餘距離
}

export function TopNavigationUI({ isNavigating, turnInstruction, remainingDistance }: TopNavigationUIProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface + 'E0' }]}>
      {isNavigating ? (
        <View style={styles.turnInstructionContainer}>
          {/* 轉彎箭頭 (待實現) */}
          <Text style={[styles.turnInstructionText, { color: colors.foreground }]}>{turnInstruction || '直行'}</Text>
          {remainingDistance !== undefined && (
            <Text style={[styles.remainingDistanceText, { color: colors.muted }]}>{remainingDistance} 公尺</Text>
          )}
        </View>
      ) : (
        <TextInput
          style={[styles.searchBar, { backgroundColor: colors.background, color: colors.foreground, borderColor: colors.border }]} 
          placeholder="搜尋地址或地點"
          placeholderTextColor={colors.muted}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // 考慮 SafeArea
    left: 10,
    right: 10,
    padding: 10,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchBar: {
    height: 40,
    borderRadius: 8,
    paddingHorizontal: 10,
  },
  turnInstructionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
  },
  turnInstructionText: {
    fontSize: 20,
    fontWeight: 'bold',
    marginRight: 10,
  },
  remainingDistanceText: {
    fontSize: 16,
    color: '#666',
  },
});
