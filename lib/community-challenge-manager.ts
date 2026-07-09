import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CommunityChallenge {
  id: string;
  name: string;
  description: string;
  type: 'distance' | 'elevation' | 'speed' | 'time' | 'calories';
  target: number;
  unit: string;
  icon: string;
  startDate: number;
  endDate: number;
  createdBy: string;
  participants: ChallengeParticipant[];
  teams: ChallengeTeam[];
  rewards?: ChallengeReward[];
  status: 'upcoming' | 'active' | 'completed';
  createdAt: number;
}

export interface ChallengeParticipant {
  userId: string;
  userName: string;
  avatar?: string;
  currentValue: number;
  rank: number;
  joinedAt: number;
  teamId?: string;
}

export interface ChallengeTeam {
  id: string;
  name: string;
  description?: string;
  members: string[]; // userId 列表
  totalValue: number;
  rank: number;
  createdAt: number;
  avatar?: string;
}

export interface ChallengeReward {
  rank: number;
  title: string;
  description: string;
  badge?: string;
  points: number;
}

export interface UserAchievement {
  id: string;
  type: 'badge' | 'trophy' | 'medal';
  name: string;
  description: string;
  icon: string;
  unlockedAt: number;
  challengeId?: string;
}

const CHALLENGES_KEY = 'community_challenges';
const USER_ACHIEVEMENTS_KEY = 'user_achievements';
const USER_POINTS_KEY = 'user_points';

export class CommunityChallengeManager {
  /**
   * 創建挑戰
   */
  static async createChallenge(
    name: string,
    description: string,
    type: 'distance' | 'elevation' | 'speed' | 'time' | 'calories',
    target: number,
    unit: string,
    durationDays: number,
    createdBy: string
  ): Promise<CommunityChallenge> {
    try {
      const now = Date.now();
      const challenge: CommunityChallenge = {
        id: `challenge_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name,
        description,
        type,
        target,
        unit,
        icon: this.getIconForType(type),
        startDate: now,
        endDate: now + durationDays * 24 * 60 * 60 * 1000,
        createdBy,
        participants: [],
        teams: [],
        rewards: this.generateRewards(type),
        status: 'active',
        createdAt: now,
      };

      // 保存挑戰
      const challenges = await this.getAllChallenges();
      challenges.push(challenge);
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));

      return challenge;
    } catch (error) {
      console.error('Failed to create challenge:', error);
      throw error;
    }
  }

  /**
   * 獲取所有挑戰
   */
  static async getAllChallenges(): Promise<CommunityChallenge[]> {
    try {
      const data = await AsyncStorage.getItem(CHALLENGES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get all challenges:', error);
      return [];
    }
  }

  /**
   * 獲取活躍挑戰
   */
  static async getActiveChallenges(): Promise<CommunityChallenge[]> {
    try {
      const challenges = await this.getAllChallenges();
      const now = Date.now();

      return challenges.filter((c) => c.startDate <= now && c.endDate > now);
    } catch (error) {
      console.error('Failed to get active challenges:', error);
      return [];
    }
  }

  /**
   * 加入挑戰
   */
  static async joinChallenge(
    challengeId: string,
    userId: string,
    userName: string,
    avatar?: string
  ): Promise<boolean> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) throw new Error('Challenge not found');

      // 檢查是否已加入
      if (challenge.participants.find((p) => p.userId === userId)) {
        return true;
      }

      // 添加參與者
      challenge.participants.push({
        userId,
        userName,
        avatar,
        currentValue: 0,
        rank: challenge.participants.length + 1,
        joinedAt: Date.now(),
      });

      // 更新排名
      this.updateChallengeRankings(challenge);

      // 保存
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));

      return true;
    } catch (error) {
      console.error('Failed to join challenge:', error);
      return false;
    }
  }

  /**
   * 創建隊伍
   */
  static async createTeam(
    challengeId: string,
    teamName: string,
    description: string,
    createdBy: string,
    avatar?: string
  ): Promise<ChallengeTeam | null> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) throw new Error('Challenge not found');

      const team: ChallengeTeam = {
        id: `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: teamName,
        description,
        members: [createdBy],
        totalValue: 0,
        rank: challenge.teams.length + 1,
        createdAt: Date.now(),
        avatar,
      };

      challenge.teams.push(team);

      // 保存
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));

      return team;
    } catch (error) {
      console.error('Failed to create team:', error);
      return null;
    }
  }

  /**
   * 加入隊伍
   */
  static async joinTeam(challengeId: string, teamId: string, userId: string): Promise<boolean> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) throw new Error('Challenge not found');

      const team = challenge.teams.find((t) => t.id === teamId);
      if (!team) throw new Error('Team not found');

      if (!team.members.includes(userId)) {
        team.members.push(userId);
      }

      // 更新參與者的隊伍
      const participant = challenge.participants.find((p) => p.userId === userId);
      if (participant) {
        participant.teamId = teamId;
      }

      // 保存
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));

      return true;
    } catch (error) {
      console.error('Failed to join team:', error);
      return false;
    }
  }

  /**
   * 更新參與者進度
   */
  static async updateParticipantProgress(
    challengeId: string,
    userId: string,
    value: number
  ): Promise<boolean> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) throw new Error('Challenge not found');

      const participant = challenge.participants.find((p) => p.userId === userId);
      if (!participant) throw new Error('Participant not found');

      participant.currentValue = value;

      // 更新排名
      this.updateChallengeRankings(challenge);

      // 更新隊伍進度
      if (participant.teamId) {
        const team = challenge.teams.find((t) => t.id === participant.teamId);
        if (team) {
          team.totalValue = challenge.participants
            .filter((p) => p.teamId === team.id)
            .reduce((sum, p) => sum + p.currentValue, 0);
        }
      }

      // 檢查成就
      await this.checkAndAwardAchievements(challenge, participant);

      // 保存
      await AsyncStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));

      return true;
    } catch (error) {
      console.error('Failed to update participant progress:', error);
      return false;
    }
  }

  /**
   * 更新排名
   */
  private static updateChallengeRankings(challenge: CommunityChallenge): void {
    // 按進度排序
    const sorted = [...challenge.participants].sort((a, b) => b.currentValue - a.currentValue);

    // 更新排名
    sorted.forEach((participant, index) => {
      const original = challenge.participants.find((p) => p.userId === participant.userId);
      if (original) {
        original.rank = index + 1;
      }
    });

    // 更新隊伍排名
    const teamRankings = challenge.teams.sort((a, b) => b.totalValue - a.totalValue);
    teamRankings.forEach((team, index) => {
      team.rank = index + 1;
    });
  }

  /**
   * 檢查並頒發成就
   */
  private static async checkAndAwardAchievements(
    challenge: CommunityChallenge,
    participant: ChallengeParticipant
  ): Promise<void> {
    try {
      const achievements = await this.getUserAchievements(participant.userId);

      // 檢查是否達成目標
      if (participant.currentValue >= challenge.target) {
        const achievement: UserAchievement = {
          id: `achievement_${Date.now()}`,
          type: 'badge',
          name: `${challenge.name} 完成者`,
          description: `完成了 ${challenge.name} 挑戰`,
          icon: challenge.icon,
          unlockedAt: Date.now(),
          challengeId: challenge.id,
        };

        if (!achievements.find((a) => a.challengeId === challenge.id)) {
          achievements.push(achievement);
          await this.saveUserAchievements(participant.userId, achievements);

          // 獎勵積分
          await this.addUserPoints(participant.userId, 100);
        }
      }

      // 檢查排名獎勵
      if (participant.rank === 1) {
        await this.addUserPoints(participant.userId, 500);
      } else if (participant.rank === 2) {
        await this.addUserPoints(participant.userId, 300);
      } else if (participant.rank === 3) {
        await this.addUserPoints(participant.userId, 200);
      }
    } catch (error) {
      console.error('Failed to check and award achievements:', error);
    }
  }

  /**
   * 獲取用戶成就
   */
  static async getUserAchievements(userId: string): Promise<UserAchievement[]> {
    try {
      const data = await AsyncStorage.getItem(`${USER_ACHIEVEMENTS_KEY}_${userId}`);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get user achievements:', error);
      return [];
    }
  }

  /**
   * 保存用戶成就
   */
  private static async saveUserAchievements(
    userId: string,
    achievements: UserAchievement[]
  ): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${USER_ACHIEVEMENTS_KEY}_${userId}`,
        JSON.stringify(achievements)
      );
    } catch (error) {
      console.error('Failed to save user achievements:', error);
    }
  }

  /**
   * 獲取用戶積分
   */
  static async getUserPoints(userId: string): Promise<number> {
    try {
      const data = await AsyncStorage.getItem(`${USER_POINTS_KEY}_${userId}`);
      return data ? parseInt(data) : 0;
    } catch (error) {
      console.error('Failed to get user points:', error);
      return 0;
    }
  }

  /**
   * 添加用戶積分
   */
  private static async addUserPoints(userId: string, points: number): Promise<void> {
    try {
      const current = await this.getUserPoints(userId);
      await AsyncStorage.setItem(`${USER_POINTS_KEY}_${userId}`, String(current + points));
    } catch (error) {
      console.error('Failed to add user points:', error);
    }
  }

  /**
   * 獲取排行榜
   */
  static async getLeaderboard(challengeId: string): Promise<ChallengeParticipant[]> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) return [];

      return challenge.participants.sort((a, b) => b.currentValue - a.currentValue);
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  /**
   * 獲取隊伍排行榜
   */
  static async getTeamLeaderboard(challengeId: string): Promise<ChallengeTeam[]> {
    try {
      const challenges = await this.getAllChallenges();
      const challenge = challenges.find((c) => c.id === challengeId);

      if (!challenge) return [];

      return challenge.teams.sort((a, b) => b.totalValue - a.totalValue);
    } catch (error) {
      console.error('Failed to get team leaderboard:', error);
      return [];
    }
  }

  /**
   * 獲取圖標
   */
  private static getIconForType(type: string): string {
    const icons: { [key: string]: string } = {
      distance: '📏',
      elevation: '⛰️',
      speed: '⚡',
      time: '⏱️',
      calories: '🔥',
    };
    return icons[type] || '🏆';
  }

  /**
   * 生成獎勵
   */
  private static generateRewards(type: string): ChallengeReward[] {
    return [
      {
        rank: 1,
        title: '冠軍',
        description: '挑戰冠軍',
        badge: '🥇',
        points: 500,
      },
      {
        rank: 2,
        title: '亞軍',
        description: '挑戰亞軍',
        badge: '🥈',
        points: 300,
      },
      {
        rank: 3,
        title: '季軍',
        description: '挑戰季軍',
        badge: '🥉',
        points: 200,
      },
    ];
  }
}
