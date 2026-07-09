import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import {
  CommunityChallengeManager,
  CommunityChallenge,
  ChallengeParticipant,
} from '@/lib/community-challenge-manager';

export default function ChallengesScreen() {
  const colors = useColors();
  const [challenges, setChallenges] = useState<CommunityChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallenge, setSelectedChallenge] = useState<CommunityChallenge | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [leaderboard, setLeaderboard] = useState<ChallengeParticipant[]>([]);

  // 創建挑戰表單
  const [challengeName, setChallengeName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'distance' | 'elevation' | 'speed' | 'time' | 'calories'>('distance');
  const [target, setTarget] = useState('500');
  const [duration, setDuration] = useState('30');

  useEffect(() => {
    loadChallenges();
  }, []);

  const loadChallenges = async () => {
    setLoading(true);
    try {
      const activeChallenges = await CommunityChallengeManager.getActiveChallenges();
      setChallenges(activeChallenges);
    } catch (error) {
      console.error('Failed to load challenges:', error);
      Alert.alert('錯誤', '無法載入挑戰');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateChallenge = async () => {
    if (!challengeName.trim() || !description.trim()) {
      Alert.alert('提示', '請填入挑戰名稱和描述');
      return;
    }

    try {
      const newChallenge = await CommunityChallengeManager.createChallenge(
        challengeName,
        description,
        type,
        parseInt(target),
        type === 'distance' ? 'km' : type === 'elevation' ? 'm' : type === 'speed' ? 'km/h' : type === 'time' ? 'min' : 'kcal',
        parseInt(duration),
        'current_user' // 應替換為實際用戶 ID
      );

      setChallenges([...challenges, newChallenge]);
      setChallengeName('');
      setDescription('');
      setTarget('500');
      setDuration('30');
      setShowCreateModal(false);

      Alert.alert('成功', `已創建挑戰「${newChallenge.name}」`);
    } catch (error) {
      console.error('Failed to create challenge:', error);
      Alert.alert('錯誤', '無法創建挑戰');
    }
  };

  const handleJoinChallenge = async (challenge: CommunityChallenge) => {
    try {
      const joined = await CommunityChallengeManager.joinChallenge(
        challenge.id,
        'current_user',
        'Your Name'
      );

      if (joined) {
        Alert.alert('成功', `已加入「${challenge.name}」挑戰`);
        loadChallenges();
      }
    } catch (error) {
      console.error('Failed to join challenge:', error);
      Alert.alert('錯誤', '無法加入挑戰');
    }
  };

  const handleViewLeaderboard = async (challenge: CommunityChallenge) => {
    try {
      const lb = await CommunityChallengeManager.getLeaderboard(challenge.id);
      setLeaderboard(lb);
      setSelectedChallenge(challenge);
      setShowDetailModal(true);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
      Alert.alert('錯誤', '無法載入排行榜');
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      distance: '距離',
      elevation: '爬升',
      speed: '速度',
      time: '時間',
      calories: '卡路里',
    };
    return labels[type] || type;
  };

  const getTypeIcon = (type: string) => {
    const icons: { [key: string]: string } = {
      distance: '📏',
      elevation: '⛰️',
      speed: '⚡',
      time: '⏱️',
      calories: '🔥',
    };
    return icons[type] || '🏆';
  };

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min((current / target) * 100, 100);
  };

  const formatChallengeValue = (value: number, type: string) => {
    if (type === 'distance') return `${value.toFixed(1)} km`;
    if (type === 'elevation') return `${Math.round(value)} m`;
    if (type === 'speed') return `${value.toFixed(1)} km/h`;
    if (type === 'time') return `${Math.round(value)} min`;
    if (type === 'calories') return `${Math.round(value)} kcal`;
    return value.toString();
  };

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 標題 */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>社群挑戰</Text>
            <TouchableOpacity
              onPress={() => setShowCreateModal(true)}
              style={[styles.addButton, { backgroundColor: colors.primary }]}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 挑戰列表 */}
        {challenges.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>還沒有活躍挑戰</Text>
          </View>
        ) : (
          challenges.map((challenge) => (
            <View
              key={challenge.id}
              style={[styles.challengeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              {/* 挑戰頭部 */}
              <View style={styles.challengeHeader}>
                <View style={styles.challengeInfo}>
                  <Text style={[styles.challengeIcon, { fontSize: 24 }]}>
                    {getTypeIcon(challenge.type)}
                  </Text>
                  <View style={styles.challengeTextInfo}>
                    <Text style={[styles.challengeName, { color: colors.foreground }]}>
                      {challenge.name}
                    </Text>
                    <Text style={[styles.challengeType, { color: colors.muted }]}>
                      {getTypeLabel(challenge.type)} • {challenge.participants.length} 參與者
                    </Text>
                  </View>
                </View>
              </View>

              {/* 目標進度 */}
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: colors.muted }]}>
                    目標：{formatChallengeValue(challenge.target, challenge.type)}
                  </Text>
                  <Text style={[styles.progressPercentage, { color: colors.primary }]}>
                    {getProgressPercentage(
                      challenge.participants.reduce((sum, p) => sum + p.currentValue, 0),
                      challenge.target
                    ).toFixed(0)}%
                  </Text>
                </View>

                {/* 進度條 */}
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${getProgressPercentage(
                          challenge.participants.reduce((sum, p) => sum + p.currentValue, 0),
                          challenge.target
                        )}%`,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* 操作按鈕 */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => handleViewLeaderboard(challenge)}
                  style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                >
                  <Text style={[styles.actionButtonText, { color: colors.primary }]}>排行榜</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleJoinChallenge(challenge)}
                  style={[styles.actionButton, { backgroundColor: colors.success + '20' }]}
                >
                  <Text style={[styles.actionButtonText, { color: colors.success }]}>加入</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 排行榜 Modal */}
      <Modal visible={showDetailModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {selectedChallenge?.name} - 排行榜
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={[styles.closeButton, { color: colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {leaderboard.map((participant, index) => (
                <View
                  key={participant.userId}
                  style={[
                    styles.leaderboardItem,
                    {
                      backgroundColor: index < 3 ? colors.primary + '10' : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.rankBadge}>
                    <Text style={[styles.rankText, { color: colors.primary }]}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </Text>
                  </View>

                  <View style={styles.participantInfo}>
                    <Text style={[styles.participantName, { color: colors.foreground }]}>
                      {participant.userName}
                    </Text>
                    <Text style={[styles.participantValue, { color: colors.muted }]}>
                      {formatChallengeValue(participant.currentValue, selectedChallenge?.type || 'distance')}
                    </Text>
                  </View>

                  {index < 3 && (
                    <Text style={styles.medalIcon}>
                      {index === 0 ? '👑' : index === 1 ? '⭐' : '✨'}
                    </Text>
                  )}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 創建挑戰 Modal */}
      <Modal visible={showCreateModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>創建挑戰</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={[styles.closeButton, { color: colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="挑戰名稱"
                placeholderTextColor={colors.muted}
                value={challengeName}
                onChangeText={setChallengeName}
              />

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="挑戰描述"
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>挑戰類型</Text>
              <View style={styles.typeButtons}>
                {(['distance', 'elevation', 'speed', 'time', 'calories'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    onPress={() => setType(t)}
                    style={[
                      styles.typeButton,
                      {
                        backgroundColor: type === t ? colors.primary : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        {
                          color: type === t ? '#fff' : colors.foreground,
                        },
                      ]}
                    >
                      {getTypeLabel(t)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="目標值"
                placeholderTextColor={colors.muted}
                value={target}
                onChangeText={setTarget}
                keyboardType="number-pad"
              />

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="持續天數"
                placeholderTextColor={colors.muted}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                onPress={handleCreateChallenge}
                style={[styles.createButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.createButtonText}>創建挑戰</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  challengeCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  challengeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  challengeIcon: {
    fontWeight: '600',
  },
  challengeTextInfo: {
    flex: 1,
  },
  challengeName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  challengeType: {
    fontSize: 12,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
  },
  progressPercentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    fontSize: 24,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '600',
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  participantValue: {
    fontSize: 12,
  },
  medalIcon: {
    fontSize: 18,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  typeButton: {
    flex: 1,
    minWidth: '30%',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
