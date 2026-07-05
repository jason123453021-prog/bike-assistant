import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';
import { MaterialIcons } from '@expo/vector-icons';

interface TopNavigationUIProps {
  isNavigating: boolean;
  turnInstruction?: string; // 轉彎指令
  remainingDistance?: number; // 剩餘距離 (公尺)
  onSearch?: (query: string) => void;
  onCancelNavigation?: () => void;
}

/**
 * Top Navigation UI Component
 * Displays search bar when not navigating
 * Displays turn-by-turn instruction card when navigating (Google Maps style)
 */
export function TopNavigationUI({
  isNavigating,
  turnInstruction = '直行',
  remainingDistance = 0,
  onSearch,
  onCancelNavigation,
}: TopNavigationUIProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  // Parse turn instruction to extract direction and details
  const parseTurnInstruction = (instruction: string) => {
    // Example: "前方 50 公尺，向右轉" -> { direction: "右", distance: 50 }
    const match = instruction.match(/前方\s*(\d+)\s*公尺[，,]\s*向(左|右)轉/);
    if (match) {
      return {
        distance: parseInt(match[1]),
        direction: match[2],
      };
    }
    return { distance: remainingDistance, direction: '直行' };
  };

  const parsed = parseTurnInstruction(turnInstruction);

  // Get turn arrow icon based on direction
  const getTurnArrowIcon = () => {
    switch (parsed.direction) {
      case '左':
        return 'turn-left';
      case '右':
        return 'turn-right';
      default:
        return 'arrow-upward';
    }
  };

  if (isNavigating) {
    return (
      <View
        style={[
          styles.navigationContainer,
          {
            top: insets.top + 12,
            left: 12,
            right: 12,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        {/* Turn Instruction Card */}
        <View style={styles.turnCardContent}>
          {/* Turn Arrow Icon */}
          <View
            style={[
              styles.turnArrowContainer,
              { backgroundColor: colors.primary },
            ]}
          >
            <MaterialIcons
              name={getTurnArrowIcon() as any}
              size={32}
              color={colors.background}
            />
          </View>

          {/* Instruction Text */}
          <View style={styles.instructionText}>
            <Text
              style={[
                styles.distanceText,
                { color: colors.foreground },
              ]}
              numberOfLines={1}
            >
              {parsed.distance} 公尺
            </Text>
            <Text
              style={[
                styles.directionText,
                { color: colors.muted },
              ]}
              numberOfLines={1}
            >
              {parsed.direction === '左' && '向左轉'}
              {parsed.direction === '右' && '向右轉'}
              {parsed.direction === '直行' && '直行'}
            </Text>
          </View>

          {/* Cancel Button */}
          <Pressable
            onPress={onCancelNavigation}
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons
              name="close"
              size={20}
              color={colors.muted}
            />
          </Pressable>
        </View>
      </View>
    );
  }

  // Search bar when not navigating
  return (
    <View
      style={[
        styles.searchContainer,
        {
          top: insets.top + 12,
          left: 12,
          right: 12,
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={styles.searchInputWrapper}>
        <MaterialIcons
          name="search"
          size={20}
          color={colors.muted}
          style={styles.searchIcon}
        />
        <TextInput
          style={[
            styles.searchInput,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
            },
          ]}
          placeholder="搜尋地址或地點"
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => {
            if (onSearch && searchQuery.trim()) {
              onSearch(searchQuery);
            }
          }}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <Pressable
            onPress={() => setSearchQuery('')}
            style={({ pressed }) => [
              styles.clearButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <MaterialIcons
              name="clear"
              size={18}
              color={colors.muted}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navigationContainer: {
    position: 'absolute',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  turnCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  turnArrowContainer: {
    width: 56,
    height: 56,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  instructionText: {
    flex: 1,
    gap: 2,
  },
  distanceText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
  },
  directionText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 16,
  },
  cancelButton: {
    padding: 8,
    borderRadius: 6,
  },
  searchContainer: {
    position: 'absolute',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 40,
  },
  clearButton: {
    padding: 6,
  },
});
