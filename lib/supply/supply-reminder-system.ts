import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useState, useEffect, useCallback } from 'react';

export interface SupplyItem {
  id: string;
  name: string;
  threshold: number;
  unit: 'kcal' | 'ml';
  enabled: boolean;
  lastResetTime: number;
  currentConsumption: number;
}

export interface SupplyReminder {
  itemId: string;
  itemName: string;
  threshold: number;
  currentValue: number;
  unit: string;
}

const STORAGE_KEY = 'supply_items';

export class SupplyReminderManager {
  private static instance: SupplyReminderManager;
  private items: Map<string, SupplyItem> = new Map();
  private listeners: Set<(reminders: SupplyReminder[]) => void> = new Set();

  private constructor() {
    this.loadItems();
  }

  static getInstance(): SupplyReminderManager {
    if (!SupplyReminderManager.instance) {
      SupplyReminderManager.instance = new SupplyReminderManager();
    }
    return SupplyReminderManager.instance;
  }

  private async loadItems() {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const items = JSON.parse(stored) as SupplyItem[];
        items.forEach(item => this.items.set(item.id, item));
      }
    } catch (error) {
      console.error('[SupplyReminder] Failed to load items:', error);
    }
  }

  private async saveItems() {
    try {
      const items = Array.from(this.items.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('[SupplyReminder] Failed to save items:', error);
    }
  }

  async addItem(item: Omit<SupplyItem, 'lastResetTime' | 'currentConsumption'>) {
    const newItem: SupplyItem = {
      ...item,
      lastResetTime: Date.now(),
      currentConsumption: 0,
    };
    this.items.set(item.id, newItem);
    await this.saveItems();
  }

  async updateItem(id: string, updates: Partial<SupplyItem>) {
    const item = this.items.get(id);
    if (item) {
      this.items.set(id, { ...item, ...updates });
      await this.saveItems();
    }
  }

  async removeItem(id: string) {
    this.items.delete(id);
    await this.saveItems();
  }

  getItems(): SupplyItem[] {
    return Array.from(this.items.values());
  }

  updateConsumption(itemId: string, amount: number) {
    const item = this.items.get(itemId);
    if (item) {
      item.currentConsumption += amount;
      this.checkReminders();
    }
  }

  private checkReminders() {
    const reminders: SupplyReminder[] = [];

    this.items.forEach(item => {
      if (item.enabled && item.currentConsumption >= item.threshold) {
        reminders.push({
          itemId: item.id,
          itemName: item.name,
          threshold: item.threshold,
          currentValue: item.currentConsumption,
          unit: item.unit === 'kcal' ? 'kcal' : 'ml',
        });
      }
    });

    if (reminders.length > 0) {
      this.notifyListeners(reminders);
      this.triggerReminder(reminders);
    }
  }

  private async triggerReminder(reminders: SupplyReminder[]) {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      console.log('[SupplyReminder] Triggering reminder for:', reminders.map(r => r.itemName).join(', '));
    } catch (error) {
      console.error('[SupplyReminder] Failed to trigger reminder:', error);
    }
  }

  async confirmSupply(itemId: string) {
    const item = this.items.get(itemId);
    if (item) {
      item.currentConsumption = 0;
      item.lastResetTime = Date.now();
      await this.saveItems();
      this.checkReminders();
    }
  }

  subscribe(listener: (reminders: SupplyReminder[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(reminders: SupplyReminder[]) {
    this.listeners.forEach(listener => listener(reminders));
  }
}

export function useSupplyReminder() {
  const manager = SupplyReminderManager.getInstance();
  const [reminders, setReminders] = useState<SupplyReminder[]>([]);
  const [items, setItems] = useState<SupplyItem[]>([]);

  useEffect(() => {
    const unsubscribe = manager.subscribe(setReminders);
    setItems(manager.getItems());
    return unsubscribe;
  }, []);

  return {
    manager,
    reminders,
    items,
    addItem: useCallback((item: Omit<SupplyItem, 'lastResetTime' | 'currentConsumption'>) => manager.addItem(item), []),
    updateItem: useCallback((id: string, updates: Partial<SupplyItem>) => manager.updateItem(id, updates), []),
    removeItem: useCallback((id: string) => manager.removeItem(id), []),
    updateConsumption: useCallback((itemId: string, amount: number) => manager.updateConsumption(itemId, amount), []),
    confirmSupply: useCallback((itemId: string) => manager.confirmSupply(itemId), []),
  };
}
