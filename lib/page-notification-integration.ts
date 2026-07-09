import { PushNotificationService } from './push-notification-service';

/**
 * 頁面通知集成管理器
 */
export class PageNotificationIntegration {
  /**
   * 在分析頁面觸發成就通知
   */
  static triggerAchievementNotification(achievement: string) {
    PushNotificationService.sendNotification({
      title: '成就解鎖',
      body: achievement,
      type: 'achievement',
      data: { type: 'achievement', achievement },
    });
  }

  /**
   * 在隊友頁面觸發隊友上線通知
   */
  static triggerBuddyOnlineNotification(buddyName: string) {
    PushNotificationService.sendNotification({
      title: '隊友上線',
      body: `${buddyName} 開始騎乘`,
      type: 'buddy',
      data: { type: 'buddy', buddyName },
    });
  }

  /**
   * 在排行榜頁面觸發排名變化通知
   */
  static triggerRankingChangeNotification(newRank: number, previousRank: number) {
    const direction = newRank < previousRank ? '上升' : '下降';
    PushNotificationService.sendNotification({
      title: '排名變化',
      body: `你的排名${direction}至第 ${newRank} 名`,
      type: 'achievement',
      data: { type: 'ranking', newRank, previousRank },
    });
  }

  /**
   * 在訓練頁面觸發訓練提醒通知
   */
  static triggerTrainingReminderNotification(trainingType: string, time: string) {
    PushNotificationService.sendNotification({
      title: '訓練提醒',
      body: `${time} 開始 ${trainingType}`,
      type: 'training',
      data: { type: 'training', trainingType, time },
    });
  }

  /**
   * 在推薦頁面觸發推薦通知
   */
  static triggerRecommendationNotification(recommendation: string) {
    PushNotificationService.sendNotification({
      title: 'AI 推薦',
      body: recommendation,
      type: 'achievement',
      data: { type: 'recommendation', recommendation },
    });
  }

  /**
   * 在通知頁面觸發通知中心更新
   */
  static triggerNotificationCenterUpdate(count: number) {
    PushNotificationService.sendNotification({
      title: '新通知',
      body: `你有 ${count} 條新通知`,
      type: 'achievement',
      data: { type: 'notification_center', count },
    });
  }

  /**
   * 觸發天氣警告通知
   */
  static triggerWeatherWarningNotification(warning: string) {
    PushNotificationService.sendNotification({
      title: '天氣警告',
      body: warning,
      type: 'weather',
      data: { type: 'weather', warning },
    });
  }

  /**
   * 觸發挑戰進度通知
   */
  static triggerChallengeProgressNotification(challengeName: string, progress: number) {
    PushNotificationService.sendNotification({
      title: '挑戰進度',
      body: `${challengeName}: ${progress}% 完成`,
      type: 'achievement',
      data: { type: 'challenge', challengeName, progress },
    });
  }
}
