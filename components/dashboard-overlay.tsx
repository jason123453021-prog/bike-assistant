import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '@/hooks/use-colors';

interface DashboardOverlayProps {
  data: { speed: number; wattage: number; distance: number; time: number };
}

export function DashboardOverlay({ data }: DashboardOverlayProps) {
  const colors = useColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface + 'E0' }]}> {/* 半透明背景 */}
      <Text style={[styles.speedText, { color: colors.foreground }]}>{data.speed} km/h</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>瓦數: {data.wattage} W</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>距離: {(data.distance / 1000).toFixed(1)} km</Text>
      <Text style={[styles.otherText, { color: colors.muted }]}>時間: {Math.floor(data.time / 60)}m {data.time % 60}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  speedText: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  otherText: {
    fontSize: 16,
    marginTop: 5,
  },
});
