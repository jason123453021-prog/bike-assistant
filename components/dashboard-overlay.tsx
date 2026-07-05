import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/use-colors';

interface DashboardData {
  speed: number; // km/h
  power: number; // watts
  distance: number; // km
  time: number; // seconds
  altitude?: number; // meters
  heartRate?: number; // bpm
}

interface DashboardOverlayProps {
  data: DashboardData;
  isMinimalMode?: boolean;
  onToggleMinimalMode?: () => void;
}

/**
 * Dashboard Overlay Component
 * Displays real-time ride data in a semi-transparent floating panel
 * Positioned at bottom-left (Google Maps style)
 */
export function DashboardOverlay({
  data,
  isMinimalMode = false,
  onToggleMinimalMode,
}: DashboardOverlayProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  // Format time display
  const formattedTime = useMemo(() => {
    const hours = Math.floor(data.time / 3600);
    const minutes = Math.floor((data.time % 3600) / 60);
    const seconds = data.time % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  }, [data.time]);

  // Format distance display
  const formattedDistance = useMemo(() => {
    return data.distance.toFixed(2);
  }, [data.distance]);

  if (isMinimalMode) {
    return (
      <View
        style={[
          styles.minimalContainer,
          {
            bottom: insets.bottom + 16,
            left: 16,
            backgroundColor: `rgba(0, 0, 0, 0.7)`,
          },
        ]}
      >
        <Pressable onPress={onToggleMinimalMode} style={styles.minimalContent}>
          <Text style={[styles.minimalSpeed, { color: colors.foreground }]}>
            {Math.round(data.speed)} km/h
          </Text>
          <Text style={[styles.minimalDistance, { color: colors.muted }]}>
            {formattedDistance} km
          </Text>
          <Text style={[styles.minimalTime, { color: colors.muted }]}>
            {formattedTime}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          bottom: insets.bottom + 16,
          left: 16,
          backgroundColor: `rgba(0, 0, 0, 0.6)`,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Speed (最大字體，最底層) */}
      <View style={styles.speedSection}>
        <Text style={[styles.speedValue, { color: colors.foreground }]}>
          {Math.round(data.speed)}
        </Text>
        <Text style={[styles.speedUnit, { color: colors.muted }]}>km/h</Text>
      </View>

      {/* Other data stacked vertically */}
      <View style={styles.dataSection}>
        {/* Power */}
        <View style={styles.dataRow}>
          <Text style={[styles.dataLabel, { color: colors.muted }]}>功率</Text>
          <Text style={[styles.dataValue, { color: colors.foreground }]}>
            {Math.round(data.power)} W
          </Text>
        </View>

        {/* Distance */}
        <View style={styles.dataRow}>
          <Text style={[styles.dataLabel, { color: colors.muted }]}>距離</Text>
          <Text style={[styles.dataValue, { color: colors.foreground }]}>
            {formattedDistance} km
          </Text>
        </View>

        {/* Time */}
        <View style={styles.dataRow}>
          <Text style={[styles.dataLabel, { color: colors.muted }]}>時間</Text>
          <Text style={[styles.dataValue, { color: colors.foreground }]}>
            {formattedTime}
          </Text>
        </View>

        {/* Altitude (if available) */}
        {data.altitude !== undefined && (
          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.muted }]}>高度</Text>
            <Text style={[styles.dataValue, { color: colors.foreground }]}>
              {Math.round(data.altitude)} m
            </Text>
          </View>
        )}

        {/* Heart Rate (if available) */}
        {data.heartRate !== undefined && (
          <View style={styles.dataRow}>
            <Text style={[styles.dataLabel, { color: colors.muted }]}>心率</Text>
            <Text style={[styles.dataValue, { color: colors.foreground }]}>
              {Math.round(data.heartRate)} bpm
            </Text>
          </View>
        )}
      </View>

      {/* Toggle Button */}
      <Pressable
        onPress={onToggleMinimalMode}
        style={({ pressed }) => [
          styles.toggleButton,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.toggleButtonText, { color: colors.background }]}>
          精簡
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    maxWidth: 160,
    gap: 8,
  },
  speedSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  speedValue: {
    fontSize: 32,
    fontWeight: '700',
    lineHeight: 40,
  },
  speedUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
  dataSection: {
    gap: 6,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dataLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  dataValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 4,
  },
  toggleButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  minimalContainer: {
    position: 'absolute',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  minimalContent: {
    gap: 2,
  },
  minimalSpeed: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  minimalDistance: {
    fontSize: 11,
    fontWeight: '500',
  },
  minimalTime: {
    fontSize: 11,
    fontWeight: '500',
  },
});
