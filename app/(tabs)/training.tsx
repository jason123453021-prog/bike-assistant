import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { useColors } from '@/hooks/use-colors';
import { TrainingPlanManager, TrainingPlan, TrainingWorkout } from '@/lib/training-plan-manager';

export default function TrainingScreen() {
  const colors = useColors();
  const [plans, setPlans] = useState<TrainingPlan[]>([]);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TrainingPlan | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // 創建計劃表單
  const [planName, setPlanName] = useState('');
  const [selectedGoal, setSelectedGoal] = useState<'endurance' | 'speed' | 'strength' | 'recovery'>('endurance');
  const [duration, setDuration] = useState('8');
  const [ftp, setFtp] = useState('250');
  const [weeklyVolume, setWeeklyVolume] = useState('300');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const allPlans = await TrainingPlanManager.getAllPlans();
      setPlans(allPlans);

      const active = await TrainingPlanManager.getActivePlan();
      setActivePlan(active);
    } catch (error) {
      console.error('Failed to load plans:', error);
      Alert.alert('錯誤', '無法載入訓練計劃');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async () => {
    if (!planName.trim()) {
      Alert.alert('提示', '請輸入計劃名稱');
      return;
    }

    try {
      const newPlan = await TrainingPlanManager.createPlan(
        planName,
        selectedGoal,
        parseInt(duration),
        parseInt(ftp),
        parseInt(weeklyVolume)
      );

      setPlans([...plans, newPlan]);
      setPlanName('');
      setDuration('8');
      setFtp('250');
      setWeeklyVolume('300');
      setShowCreateModal(false);

      Alert.alert('成功', `已創建訓練計劃「${newPlan.name}」`);
    } catch (error) {
      console.error('Failed to create plan:', error);
      Alert.alert('錯誤', '無法創建訓練計劃');
    }
  };

  const handleSelectPlan = async (plan: TrainingPlan) => {
    try {
      await TrainingPlanManager.setActivePlan(plan.id);
      setActivePlan(plan);
      Alert.alert('成功', `已選擇訓練計劃「${plan.name}」`);
    } catch (error) {
      console.error('Failed to select plan:', error);
      Alert.alert('錯誤', '無法選擇訓練計劃');
    }
  };

  const handleDeletePlan = (plan: TrainingPlan) => {
    Alert.alert('刪除計劃', `確定要刪除「${plan.name}」嗎？`, [
      { text: '取消', onPress: () => {} },
      {
        text: '刪除',
        onPress: async () => {
          try {
            await TrainingPlanManager.deletePlan(plan.id);
            setPlans(plans.filter((p) => p.id !== plan.id));
            if (activePlan?.id === plan.id) {
              setActivePlan(null);
            }
            Alert.alert('成功', '已刪除訓練計劃');
          } catch (error) {
            console.error('Failed to delete plan:', error);
            Alert.alert('錯誤', '無法刪除訓練計劃');
          }
        },
      },
    ]);
  };

  const getGoalLabel = (goal: string) => {
    const labels: { [key: string]: string } = {
      endurance: '耐力訓練',
      speed: '速度訓練',
      strength: '力量訓練',
      recovery: '恢復訓練',
    };
    return labels[goal] || goal;
  };

  const renderPlanItem = ({ item }: { item: TrainingPlan }) => {
    const progress = TrainingPlanManager.getPlanProgress(item);
    const stats = TrainingPlanManager.getPlanStats(item);
    const isActive = activePlan?.id === item.id;

    return (
      <TouchableOpacity
        onPress={() => {
          setSelectedPlan(item);
          setShowDetailModal(true);
        }}
        style={[
          styles.planCard,
          {
            backgroundColor: isActive ? colors.primary + '15' : colors.surface,
            borderColor: isActive ? colors.primary : colors.border,
          },
        ]}
      >
        <View style={styles.planHeader}>
          <View style={styles.planInfo}>
            <Text style={[styles.planName, { color: colors.foreground }]}>{item.name}</Text>
            <Text style={[styles.planGoal, { color: colors.muted }]}>
              {getGoalLabel(item.goal)} • {item.duration} 週
            </Text>
          </View>
          {isActive && (
            <View style={[styles.activeBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.activeBadgeText}>進行中</Text>
            </View>
          )}
        </View>

        {/* 進度條 */}
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: `${progress}%`,
              },
            ]}
          />
        </View>

        {/* 統計信息 */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.muted }]}>完成</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {stats.completedWorkouts}/{stats.totalWorkouts}
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.muted }]}>時間</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {Math.round(stats.totalVolume / 60)}h
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors.muted }]}>功率</Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              {Math.round(stats.averagePower)}W
            </Text>
          </View>
        </View>

        {/* 操作按鈕 */}
        <View style={styles.actionRow}>
          {!isActive && (
            <TouchableOpacity
              onPress={() => handleSelectPlan(item)}
              style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
            >
              <Text style={[styles.actionButtonText, { color: colors.primary }]}>開始</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => handleDeletePlan(item)}
            style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
          >
            <Text style={[styles.actionButtonText, { color: colors.error }]}>刪除</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderWorkoutItem = ({ item }: { item: TrainingWorkout }) => (
    <View
      style={[
        styles.workoutItem,
        {
          backgroundColor: item.completed ? colors.success + '15' : colors.surface,
          borderColor: item.completed ? colors.success : colors.border,
        },
      ]}
    >
      <View style={styles.workoutHeader}>
        <View style={styles.workoutInfo}>
          <Text style={[styles.workoutName, { color: colors.foreground }]}>
            {item.completed ? '✓ ' : ''}
            {item.name}
          </Text>
          <Text style={[styles.workoutType, { color: colors.muted }]}>
            第 {item.week} 週 • {item.duration} 分鐘
          </Text>
        </View>
        <Text style={[styles.intensity, { color: colors.primary }]}>{item.intensity}%</Text>
      </View>

      <View style={styles.workoutDetails}>
        <Text style={[styles.detailText, { color: colors.muted }]}>
          目標功率：{item.targetPower}W • 強度：{item.type}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ScreenContainer className="flex items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer className="bg-background">
      {/* 標題 */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>訓練計劃</Text>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            style={[styles.addButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.addButtonText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 活躍計劃 */}
      {activePlan && (
        <View style={[styles.activePlanSection, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>當前計劃</Text>
          <View style={[styles.activePlanCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.activePlanName, { color: colors.foreground }]}>
              {activePlan.name}
            </Text>
            <Text style={[styles.activePlanGoal, { color: colors.muted }]}>
              {getGoalLabel(activePlan.goal)}
            </Text>

            {/* 本週推薦 */}
            <View style={styles.weeklyRecommendations}>
              <Text style={[styles.recommendTitle, { color: colors.foreground }]}>本週推薦訓練</Text>
              <FlatList
                data={activePlan.workouts.filter((w) => w.week === 1 && !w.completed).slice(0, 3)}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.recommendItem, { backgroundColor: colors.background }]}>
                    <Text style={[styles.recommendName, { color: colors.foreground }]}>
                      {item.name}
                    </Text>
                    <Text style={[styles.recommendDetails, { color: colors.muted }]}>
                      {item.duration}min @ {item.intensity}%
                    </Text>
                  </View>
                )}
                scrollEnabled={false}
              />
            </View>
          </View>
        </View>
      )}

      {/* 計劃列表 */}
      {plans.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>還沒有訓練計劃</Text>
          <TouchableOpacity
            onPress={() => setShowCreateModal(true)}
            style={[styles.createButton, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.createButtonText}>創建第一個計劃</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={plans}
          keyExtractor={(item) => item.id}
          renderItem={renderPlanItem}
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}

      {/* 創建計劃 Modal */}
      <Modal visible={showCreateModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>創建訓練計劃</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <Text style={[styles.closeButton, { color: colors.muted }]}>✕</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="計劃名稱"
                placeholderTextColor={colors.muted}
                value={planName}
                onChangeText={setPlanName}
              />

              <Text style={[styles.label, { color: colors.foreground }]}>訓練目標</Text>
              <View style={styles.goalButtons}>
                {(['endurance', 'speed', 'strength', 'recovery'] as const).map((goal) => (
                  <TouchableOpacity
                    key={goal}
                    onPress={() => setSelectedGoal(goal)}
                    style={[
                      styles.goalButton,
                      {
                        backgroundColor: selectedGoal === goal ? colors.primary : colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.goalButtonText,
                        {
                          color: selectedGoal === goal ? '#fff' : colors.foreground,
                        },
                      ]}
                    >
                      {getGoalLabel(goal)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="計劃週數"
                placeholderTextColor={colors.muted}
                value={duration}
                onChangeText={setDuration}
                keyboardType="number-pad"
              />

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="FTP (功能閾值功率)"
                placeholderTextColor={colors.muted}
                value={ftp}
                onChangeText={setFtp}
                keyboardType="number-pad"
              />

              <TextInput
                style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                placeholder="每週騎乘時間 (分鐘)"
                placeholderTextColor={colors.muted}
                value={weeklyVolume}
                onChangeText={setWeeklyVolume}
                keyboardType="number-pad"
              />

              <TouchableOpacity
                onPress={handleCreatePlan}
                style={[styles.createPlanButton, { backgroundColor: colors.primary }]}
              >
                <Text style={styles.createPlanButtonText}>創建計劃</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 計劃詳情 Modal */}
      <Modal visible={showDetailModal} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                {selectedPlan?.name}
              </Text>
              <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                <Text style={[styles.closeButton, { color: colors.muted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedPlan && (
              <FlatList
                data={selectedPlan.workouts.slice(0, 10)}
                keyExtractor={(item) => item.id}
                renderItem={renderWorkoutItem}
                scrollEnabled={true}
              />
            )}
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
  activePlanSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  activePlanCard: {
    padding: 12,
    borderRadius: 12,
  },
  activePlanName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  activePlanGoal: {
    fontSize: 13,
    marginBottom: 12,
  },
  weeklyRecommendations: {
    marginTop: 12,
  },
  recommendTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendItem: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  recommendName: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  recommendDetails: {
    fontSize: 11,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  planCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  planInfo: {
    flex: 1,
  },
  planName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  planGoal: {
    fontSize: 12,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '600',
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
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 16,
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  workoutItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  workoutType: {
    fontSize: 11,
  },
  intensity: {
    fontSize: 13,
    fontWeight: '600',
  },
  workoutDetails: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  detailText: {
    fontSize: 11,
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
  goalButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  goalButton: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  goalButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  createPlanButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  createPlanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
