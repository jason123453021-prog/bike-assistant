import { View, Text } from 'react-native';
import { useColors } from '@/hooks/use-colors';

export interface PlaybackStatsData {
  speed: number; // km/h
  heartRate: number; // bpm
  power: number; // watts
  altitude: number; // meters
  distance: number; // km
  time: number; // seconds
}

interface PlaybackStatsCardProps {
  data: PlaybackStatsData;
  timestamp?: string;
}

/**
 * 回放統計卡片組件
 * 顯示當前回放位置的實時數據：速度、心率、功率、海拔等
 */
export function PlaybackStatsCard({ data, timestamp }: PlaybackStatsCardProps) {
  const colors = useColors();

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getHeartRateColor = (hr: number) => {
    if (hr < 100) return '#22C55E'; // 綠色 - 恢復區
    if (hr < 130) return '#3B82F6'; // 藍色 - 有氧基礎
    if (hr < 160) return '#F59E0B'; // 黃色 - 有氧耐力
    if (hr < 180) return '#EF4444'; // 紅色 - 乳酸閾值
    return '#DC2626'; // 深紅 - 最大強度
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      {/* 時間戳 */}
      {timestamp && (
        <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8, textAlign: 'center' }}>
          {timestamp}
        </Text>
      )}

      {/* 統計數據網格 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 8 }}>
        {/* 速度 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>速度</Text>
          <Text style={{ color: '#10B981', fontSize: 18, fontWeight: 'bold' }}>
            {data.speed.toFixed(1)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>km/h</Text>
        </View>

        {/* 心率 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>心率</Text>
          <Text style={{ color: getHeartRateColor(data.heartRate), fontSize: 18, fontWeight: 'bold' }}>
            {Math.round(data.heartRate)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>bpm</Text>
        </View>

        {/* 功率 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>功率</Text>
          <Text style={{ color: '#F59E0B', fontSize: 18, fontWeight: 'bold' }}>
            {Math.round(data.power)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>W</Text>
        </View>

        {/* 海拔 */}
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>海拔</Text>
          <Text style={{ color: '#8B5CF6', fontSize: 18, fontWeight: 'bold' }}>
            {Math.round(data.altitude)}
          </Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>m</Text>
        </View>
      </View>

      {/* 距離和時間 */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border }}>
        <View>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>距離</Text>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: 'bold' }}>
            {data.distance.toFixed(2)} km
          </Text>
        </View>
        <View>
          <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>時間</Text>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: 'bold' }}>
            {formatTime(data.time)}
          </Text>
        </View>
      </View>
    </View>
  );
}
