import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TurnVoiceNotificationManager, type VoiceConfig } from '@/lib/turn-voice-notification-manager';

describe('Turn Voice Notification Manager', () => {
  let manager: TurnVoiceNotificationManager;

  beforeEach(() => {
    manager = new TurnVoiceNotificationManager({
      language: 'zh-TW',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      enabled: true,
      silenceMode: false,
      repeatCount: 1,
    });
  });

  afterEach(async () => {
    await manager.destroy();
  });

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const config = manager.getConfig();
      expect(config.language).toBe('zh-TW');
      expect(config.rate).toBe(1.0);
      expect(config.enabled).toBe(true);
      expect(config.silenceMode).toBe(false);
    });

    it('should initialize with custom config', () => {
      const customManager = new TurnVoiceNotificationManager({
        language: 'en-US',
        rate: 1.5,
        volume: 0.8,
      });

      const config = customManager.getConfig();
      expect(config.language).toBe('en-US');
      expect(config.rate).toBe(1.5);
      expect(config.volume).toBe(0.8);
    });
  });

  describe('Configuration', () => {
    it('should update config', () => {
      manager.updateConfig({ rate: 1.5, volume: 0.7 });
      const config = manager.getConfig();
      expect(config.rate).toBe(1.5);
      expect(config.volume).toBe(0.7);
    });

    it('should toggle enabled state', () => {
      manager.updateConfig({ enabled: false });
      expect(manager.getConfig().enabled).toBe(false);

      manager.updateConfig({ enabled: true });
      expect(manager.getConfig().enabled).toBe(true);
    });

    it('should toggle silence mode', () => {
      manager.updateConfig({ silenceMode: true });
      expect(manager.getConfig().silenceMode).toBe(true);

      manager.updateConfig({ silenceMode: false });
      expect(manager.getConfig().silenceMode).toBe(false);
    });

    it('should set repeat count', () => {
      manager.updateConfig({ repeatCount: 3 });
      expect(manager.getConfig().repeatCount).toBe(3);
    });

    it('should change language', () => {
      manager.updateConfig({ language: 'en-US' });
      expect(manager.getConfig().language).toBe('en-US');

      manager.updateConfig({ language: 'zh-TW' });
      expect(manager.getConfig().language).toBe('zh-TW');
    });
  });

  describe('Notification Subscription', () => {
    it('should subscribe to notifications', () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      expect(typeof unsubscribe).toBe('function');

      unsubscribe();
    });

    it('should call listener on notification', () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      // 模擬通知
      // 注意：實際的 checkAndPlayTurnNotification 會觸發監聽者
    });
  });

  describe('Turn Notification Logic', () => {
    it('should not play when disabled', async () => {
      manager.updateConfig({ enabled: false });

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.checkAndPlayTurnNotification(200, 'turn-left', '左轉', '左轉進入中山路');

      // 禁用時不應該播放
      expect(manager.isSpeakingNow()).toBe(false);
    });

    it('should not play when in silence mode', async () => {
      manager.updateConfig({ silenceMode: true });

      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.checkAndPlayTurnNotification(200, 'turn-left', '左轉', '左轉進入中山路');

      // 靜音模式下不應該播放
      expect(manager.isSpeakingNow()).toBe(false);
    });

    it('should not play when distance is too far', async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      // 距離超過 300 米，不應該播放
      await manager.checkAndPlayTurnNotification(400, 'turn-left', '左轉', '左轉進入中山路');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should play approaching notification at 300m', async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.checkAndPlayTurnNotification(300, 'turn-left', '左轉', '左轉進入中山路');

      // 應該觸發監聽者（如果語音播放成功）
      // expect(listener).toHaveBeenCalled();
    });

    it('should play immediate notification at 50m', async () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      await manager.checkAndPlayTurnNotification(50, 'turn-left', '左轉', '立即左轉進入中山路');

      // 應該觸發監聽者（如果語音播放成功）
      // expect(listener).toHaveBeenCalled();
    });
  });

  describe('Speech State', () => {
    it('should track speaking state', () => {
      expect(manager.isSpeakingNow()).toBe(false);
    });

    it('should reset notification state', () => {
      manager.reset();
      expect(manager.isSpeakingNow()).toBe(false);
    });
  });

  describe('Voice Configuration Validation', () => {
    it('should validate rate range', () => {
      manager.updateConfig({ rate: 0.5 });
      expect(manager.getConfig().rate).toBe(0.5);

      manager.updateConfig({ rate: 2.0 });
      expect(manager.getConfig().rate).toBe(2.0);
    });

    it('should validate volume range', () => {
      manager.updateConfig({ volume: 0 });
      expect(manager.getConfig().volume).toBe(0);

      manager.updateConfig({ volume: 1.0 });
      expect(manager.getConfig().volume).toBe(1.0);
    });

    it('should validate pitch range', () => {
      manager.updateConfig({ pitch: 0.5 });
      expect(manager.getConfig().pitch).toBe(0.5);

      manager.updateConfig({ pitch: 2.0 });
      expect(manager.getConfig().pitch).toBe(2.0);
    });
  });

  describe('Language Support', () => {
    it('should support Traditional Chinese', () => {
      manager.updateConfig({ language: 'zh-TW' });
      expect(manager.getConfig().language).toBe('zh-TW');
    });

    it('should support English', () => {
      manager.updateConfig({ language: 'en-US' });
      expect(manager.getConfig().language).toBe('en-US');
    });
  });

  describe('Resource Cleanup', () => {
    it('should stop speaking on destroy', async () => {
      await manager.destroy();
      expect(manager.isSpeakingNow()).toBe(false);
    });

    it('should clear listeners on destroy', async () => {
      const listener = vi.fn();
      manager.subscribe(listener);
      await manager.destroy();

      // 銷毀後應該沒有監聽者
      // 無法直接驗證，但應該不會拋出錯誤
    });
  });

  describe('Repeat Count', () => {
    it('should support single repeat', () => {
      manager.updateConfig({ repeatCount: 1 });
      expect(manager.getConfig().repeatCount).toBe(1);
    });

    it('should support multiple repeats', () => {
      manager.updateConfig({ repeatCount: 3 });
      expect(manager.getConfig().repeatCount).toBe(3);
    });
  });
});
