import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';
import { getUserAccountManager } from '@/lib/user-account-manager';

export interface AuthScreenProps {
  onAuthSuccess?: () => void;
}

/**
 * 登入/註冊屏幕
 */
export function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('錯誤', '請填寫所有必填欄位');
      return;
    }

    if (!isLogin && !username) {
      Alert.alert('錯誤', '請填寫用戶名');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert('錯誤', '密碼不相符');
      return;
    }

    setIsLoading(true);

    try {
      const userManager = getUserAccountManager();

      if (isLogin) {
        await userManager.login(email, password);
      } else {
        await userManager.register(email, username, password);
      }

      Alert.alert('成功', isLogin ? '登入成功' : '註冊成功');
      onAuthSuccess?.();
    } catch (error) {
      Alert.alert('錯誤', String(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ScreenContainer className="bg-background">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="p-4">
        <View className="flex-1 justify-center gap-6">
          {/* 標題 */}
          <View className="items-center mb-4">
            <Text className="text-4xl font-bold text-primary mb-2">🚴</Text>
            <Text className="text-2xl font-bold text-foreground">
              {isLogin ? '歡迎回來' : '加入社群'}
            </Text>
            <Text className="text-muted text-sm mt-2">
              {isLogin ? '登入您的帳戶' : '創建新帳戶'}
            </Text>
          </View>

          {/* 表單 */}
          <View className="gap-4">
            {/* Email 輸入框 */}
            <View>
              <Text className="text-foreground font-semibold mb-2">電子郵件</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="your@email.com"
                placeholderTextColor="rgba(107, 114, 128, 0.5)"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* 用戶名輸入框（僅註冊） */}
            {!isLogin && (
              <View>
                <Text className="text-foreground font-semibold mb-2">用戶名</Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="your_username"
                  placeholderTextColor="rgba(107, 114, 128, 0.5)"
                  value={username}
                  onChangeText={setUsername}
                  editable={!isLoading}
                  autoCapitalize="none"
                />
              </View>
            )}

            {/* 密碼輸入框 */}
            <View>
              <Text className="text-foreground font-semibold mb-2">密碼</Text>
              <TextInput
                className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                placeholder="••••••••"
                placeholderTextColor="rgba(107, 114, 128, 0.5)"
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
                secureTextEntry
              />
            </View>

            {/* 確認密碼輸入框（僅註冊） */}
            {!isLogin && (
              <View>
                <Text className="text-foreground font-semibold mb-2">確認密碼</Text>
                <TextInput
                  className="bg-surface border border-border rounded-lg px-4 py-3 text-foreground"
                  placeholder="••••••••"
                  placeholderTextColor="rgba(107, 114, 128, 0.5)"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!isLoading}
                  secureTextEntry
                />
              </View>
            )}
          </View>

          {/* 登入/註冊按鈕 */}
          <Pressable
            onPress={handleAuth}
            disabled={isLoading}
            className={`bg-primary px-6 py-4 rounded-lg active:opacity-80 ${
              isLoading ? 'opacity-50' : ''
            }`}
          >
            <Text className="text-white text-center font-bold text-lg">
              {isLoading ? '處理中...' : isLogin ? '登入' : '註冊'}
            </Text>
          </Pressable>

          {/* 切換登入/註冊 */}
          <View className="flex-row justify-center items-center gap-2">
            <Text className="text-muted">
              {isLogin ? '還沒有帳戶？' : '已有帳戶？'}
            </Text>
            <Pressable onPress={() => setIsLogin(!isLogin)} disabled={isLoading}>
              <Text className="text-primary font-bold">
                {isLogin ? '立即註冊' : '登入'}
              </Text>
            </Pressable>
          </View>

          {/* 提示文本 */}
          <View className="bg-primary/10 rounded-lg p-4 border border-primary/20">
            <Text className="text-primary text-xs text-center">
              {isLogin
                ? '使用示例帳戶：demo@example.com / password123'
                : '註冊後可以分享路線和加入社群'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
