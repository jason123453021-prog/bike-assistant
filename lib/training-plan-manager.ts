import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TrainingPlan {
  id: string;
  name: string;
  description?: string;
  goal: 'endurance' | 'speed' | 'strength' | 'recovery';
  duration: number; // 週數
  startDate: number; // 時間戳
  endDate: number; // 時間戳
  ftp: number; // 功能閾值功率
  weeklyVolume: number; // 每週騎乘時間（分鐘）
  createdAt: number;
  workouts: TrainingWorkout[];
  progress: TrainingProgress[];
}

export interface TrainingWorkout {
  id: string;
  week: number;
  day: number;
  name: string;
  description?: string;
  type: 'endurance' | 'threshold' | 'interval' | 'recovery' | 'strength';
  duration: number; // 分鐘
  intensity: number; // 0-100
  targetPower?: number; // 瓦
  targetHeartRate?: number; // bpm
  intervals?: TrainingInterval[];
  completed: boolean;
  completedAt?: number;
  actualDuration?: number; // 實際時間
  actualPower?: number; // 實際功率
  actualHeartRate?: number; // 實際心率
  notes?: string;
}

export interface TrainingInterval {
  duration: number; // 秒
  intensity: number; // 0-100
  targetPower?: number; // 瓦
  rest?: number; // 休息秒數
}

export interface TrainingProgress {
  week: number;
  completedWorkouts: number;
  totalWorkouts: number;
  totalVolume: number; // 分鐘
  averagePower?: number; // 瓦
  averageHeartRate?: number; // bpm
  notes?: string;
}

const TRAINING_PLANS_KEY = 'training_plans';
const ACTIVE_PLAN_KEY = 'active_training_plan';

export class TrainingPlanManager {
  /**
   * 創建訓練計劃
   */
  static async createPlan(
    name: string,
    goal: 'endurance' | 'speed' | 'strength' | 'recovery',
    duration: number,
    ftp: number,
    weeklyVolume: number
  ): Promise<TrainingPlan> {
    try {
      const now = Date.now();
      const plan: TrainingPlan = {
        id: `plan_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        goal,
        duration,
        ftp,
        weeklyVolume,
        startDate: now,
        endDate: now + duration * 7 * 24 * 60 * 60 * 1000,
        createdAt: now,
        workouts: this.generateWorkouts(goal, duration, ftp, weeklyVolume),
        progress: [],
      };

      // 保存計劃
      const plans = await this.getAllPlans();
      plans.push(plan);
      await AsyncStorage.setItem(TRAINING_PLANS_KEY, JSON.stringify(plans));

      return plan;
    } catch (error) {
      console.error('Failed to create training plan:', error);
      throw error;
    }
  }

  /**
   * 生成訓練課程
   */
  private static generateWorkouts(
    goal: string,
    duration: number,
    ftp: number,
    weeklyVolume: number
  ): TrainingWorkout[] {
    const workouts: TrainingWorkout[] = [];
    let workoutId = 0;

    for (let week = 1; week <= duration; week++) {
      const weekWorkouts = this.generateWeeklyWorkouts(goal, week, ftp, weeklyVolume);
      workouts.push(
        ...weekWorkouts.map((w, index) => ({
          ...w,
          id: `workout_${workoutId++}`,
          week,
          day: index + 1,
          completed: false,
        }))
      );
    }

    return workouts;
  }

  /**
   * 生成每週訓練課程
   */
  private static generateWeeklyWorkouts(
    goal: string,
    week: number,
    ftp: number,
    weeklyVolume: number
  ): Omit<TrainingWorkout, 'id' | 'week' | 'day' | 'completed'>[] {
    const workouts: Omit<TrainingWorkout, 'id' | 'week' | 'day' | 'completed'>[] = [];

    if (goal === 'endurance') {
      // 耐力訓練：長距離、恢復、節奏
      workouts.push(
        {
          name: '恢復騎乘',
          type: 'recovery',
          duration: 45,
          intensity: 50,
          targetPower: Math.round(ftp * 0.5),
        },
        {
          name: '節奏騎乘',
          type: 'threshold',
          duration: 60,
          intensity: 75,
          targetPower: Math.round(ftp * 0.75),
        },
        {
          name: '長距離騎乘',
          type: 'endurance',
          duration: weeklyVolume / 3,
          intensity: 65,
          targetPower: Math.round(ftp * 0.65),
        }
      );
    } else if (goal === 'speed') {
      // 速度訓練：間歇、高強度
      workouts.push(
        {
          name: '熱身',
          type: 'recovery',
          duration: 15,
          intensity: 50,
          targetPower: Math.round(ftp * 0.5),
        },
        {
          name: '高強度間歇',
          type: 'interval',
          duration: 40,
          intensity: 120,
          targetPower: Math.round(ftp * 1.2),
          intervals: [
            { duration: 300, intensity: 120, targetPower: Math.round(ftp * 1.2), rest: 120 },
            { duration: 300, intensity: 120, targetPower: Math.round(ftp * 1.2), rest: 120 },
            { duration: 300, intensity: 120, targetPower: Math.round(ftp * 1.2), rest: 120 },
          ],
        },
        {
          name: '恢復騎乘',
          type: 'recovery',
          duration: 30,
          intensity: 50,
          targetPower: Math.round(ftp * 0.5),
        }
      );
    } else if (goal === 'strength') {
      // 力量訓練：爬坡、大齒盤
      workouts.push(
        {
          name: '爬坡訓練',
          type: 'strength',
          duration: 50,
          intensity: 85,
          targetPower: Math.round(ftp * 0.85),
        },
        {
          name: '大齒盤騎乘',
          type: 'strength',
          duration: 40,
          intensity: 80,
          targetPower: Math.round(ftp * 0.8),
        }
      );
    } else if (goal === 'recovery') {
      // 恢復訓練：輕鬆騎乘
      workouts.push(
        {
          name: '輕鬆騎乘',
          type: 'recovery',
          duration: weeklyVolume / 2,
          intensity: 50,
          targetPower: Math.round(ftp * 0.5),
        }
      );
    }

    return workouts;
  }

  /**
   * 獲取所有訓練計劃
   */
  static async getAllPlans(): Promise<TrainingPlan[]> {
    try {
      const data = await AsyncStorage.getItem(TRAINING_PLANS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get training plans:', error);
      return [];
    }
  }

  /**
   * 獲取活躍計劃
   */
  static async getActivePlan(): Promise<TrainingPlan | null> {
    try {
      const planId = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
      if (!planId) return null;

      const plans = await this.getAllPlans();
      return plans.find((p) => p.id === planId) || null;
    } catch (error) {
      console.error('Failed to get active plan:', error);
      return null;
    }
  }

  /**
   * 設置活躍計劃
   */
  static async setActivePlan(planId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_PLAN_KEY, planId);
    } catch (error) {
      console.error('Failed to set active plan:', error);
    }
  }

  /**
   * 完成訓練課程
   */
  static async completeWorkout(
    planId: string,
    workoutId: string,
    actualDuration: number,
    actualPower?: number,
    actualHeartRate?: number,
    notes?: string
  ): Promise<void> {
    try {
      const plans = await this.getAllPlans();
      const plan = plans.find((p) => p.id === planId);
      if (!plan) throw new Error('Plan not found');

      const workout = plan.workouts.find((w) => w.id === workoutId);
      if (!workout) throw new Error('Workout not found');

      workout.completed = true;
      workout.completedAt = Date.now();
      workout.actualDuration = actualDuration;
      workout.actualPower = actualPower;
      workout.actualHeartRate = actualHeartRate;
      workout.notes = notes;

      // 更新進度
      this.updateProgress(plan);

      // 保存
      await AsyncStorage.setItem(TRAINING_PLANS_KEY, JSON.stringify(plans));
    } catch (error) {
      console.error('Failed to complete workout:', error);
    }
  }

  /**
   * 更新進度
   */
  private static updateProgress(plan: TrainingPlan): void {
    const weeklyProgress: { [key: number]: TrainingProgress } = {};

    for (const workout of plan.workouts) {
      if (!weeklyProgress[workout.week]) {
        weeklyProgress[workout.week] = {
          week: workout.week,
          completedWorkouts: 0,
          totalWorkouts: 0,
          totalVolume: 0,
        };
      }

      weeklyProgress[workout.week].totalWorkouts++;
      if (workout.completed) {
        weeklyProgress[workout.week].completedWorkouts++;
        weeklyProgress[workout.week].totalVolume += workout.actualDuration || workout.duration;
      }

      if (workout.actualPower) {
        const current = weeklyProgress[workout.week].averagePower || 0;
        weeklyProgress[workout.week].averagePower =
          (current + workout.actualPower) / 2;
      }

      if (workout.actualHeartRate) {
        const current = weeklyProgress[workout.week].averageHeartRate || 0;
        weeklyProgress[workout.week].averageHeartRate =
          (current + workout.actualHeartRate) / 2;
      }
    }

    plan.progress = Object.values(weeklyProgress);
  }

  /**
   * 獲取本週推薦訓練
   */
  static async getWeeklyRecommendations(planId: string): Promise<TrainingWorkout[]> {
    try {
      const plans = await this.getAllPlans();
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return [];

      const now = Date.now();
      const weeksElapsed = Math.floor((now - plan.startDate) / (7 * 24 * 60 * 60 * 1000)) + 1;

      return plan.workouts.filter((w) => w.week === weeksElapsed && !w.completed);
    } catch (error) {
      console.error('Failed to get weekly recommendations:', error);
      return [];
    }
  }

  /**
   * 刪除訓練計劃
   */
  static async deletePlan(planId: string): Promise<void> {
    try {
      const plans = await this.getAllPlans();
      const filtered = plans.filter((p) => p.id !== planId);
      await AsyncStorage.setItem(TRAINING_PLANS_KEY, JSON.stringify(filtered));

      // 如果刪除的是活躍計劃，清除
      const activePlanId = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
      if (activePlanId === planId) {
        await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
      }
    } catch (error) {
      console.error('Failed to delete plan:', error);
    }
  }

  /**
   * 獲取計劃進度百分比
   */
  static getPlanProgress(plan: TrainingPlan): number {
    const totalWorkouts = plan.workouts.length;
    const completedWorkouts = plan.workouts.filter((w) => w.completed).length;
    return totalWorkouts > 0 ? (completedWorkouts / totalWorkouts) * 100 : 0;
  }

  /**
   * 獲取計劃統計
   */
  static getPlanStats(plan: TrainingPlan) {
    const completedWorkouts = plan.workouts.filter((w) => w.completed);
    const totalVolume = completedWorkouts.reduce((sum, w) => sum + (w.actualDuration || w.duration), 0);
    const averagePower = completedWorkouts.length > 0
      ? completedWorkouts.reduce((sum, w) => sum + (w.actualPower || 0), 0) / completedWorkouts.length
      : 0;
    const averageHeartRate = completedWorkouts.length > 0
      ? completedWorkouts.reduce((sum, w) => sum + (w.actualHeartRate || 0), 0) / completedWorkouts.length
      : 0;

    return {
      completedWorkouts: completedWorkouts.length,
      totalWorkouts: plan.workouts.length,
      totalVolume,
      averagePower,
      averageHeartRate,
    };
  }
}
