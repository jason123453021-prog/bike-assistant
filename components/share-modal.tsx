/**
 * 分享模態框組件
 *
 * 功能：
 * - 選擇要分享給的好友
 * - 添加分享備註
 * - 設置分享權限（允許評論、允許點讚）
 */

import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useColors } from "@/hooks/use-colors";

export interface Friend {
  id: number;
  name: string | null;
  email: string | null;
}

export interface ShareModalProps {
  visible: boolean;
  friends: Friend[];
  isLoading?: boolean;
  onShare: (friendId: number, note: string, canComment: boolean, canLike: boolean) => Promise<void>;
  onClose: () => void;
}

export function ShareModal({
  visible,
  friends,
  isLoading = false,
  onShare,
  onClose,
}: ShareModalProps) {
  const colors = useColors();
  const [selectedFriendId, setSelectedFriendId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [canComment, setCanComment] = useState(true);
  const [canLike, setCanLike] = useState(true);
  const [isSharing, setIsSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (!selectedFriendId) {
      Alert.alert("錯誤", "請選擇要分享給的好友");
      return;
    }

    setIsSharing(true);
    try {
      await onShare(selectedFriendId, note, canComment, canLike);
      Alert.alert("成功", "分享成功");
      handleClose();
    } catch (error) {
      console.error("[ShareModal] 分享失敗:", error);
      Alert.alert("錯誤", "分享失敗，請重試");
    } finally {
      setIsSharing(false);
    }
  }, [selectedFriendId, note, canComment, canLike, onShare]);

  const handleClose = useCallback(() => {
    setSelectedFriendId(null);
    setNote("");
    setCanComment(true);
    setCanLike(true);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      {/* 背景遮罩 */}
      <Pressable
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.5)",
          justifyContent: "center",
          alignItems: "center",
        }}
        onPress={handleClose}
      >
        {/* 模態框內容 */}
        <Pressable
          style={{
            backgroundColor: colors.background,
            borderRadius: 12,
            padding: 16,
            width: "85%",
            maxHeight: "80%",
            borderWidth: 1,
            borderColor: `${colors.border}40`,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={{ fontSize: 18, fontWeight: "600", color: colors.foreground, marginBottom: 16 /* internal spacing */ }}>
            分享騎乘記錄
          </Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 好友列表 */}
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 /* internal spacing */ }}>
              選擇好友
            </Text>
            <View style={{ marginBottom: 16 /* internal spacing */, gap: 8 }}>
              {friends.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 12 }}>暫無好友</Text>
              ) : (
                friends.map((friend) => (
                  <Pressable
                    key={friend.id}
                    onPress={() => setSelectedFriendId(friend.id)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor:
                        selectedFriendId === friend.id ? colors.primary : `${colors.border}40`,
                      backgroundColor:
                        selectedFriendId === friend.id ? `${colors.primary}15` : colors.surface,
                    }}
                  >
                    <Text style={{ color: colors.foreground, fontWeight: "500" }}>
                      {friend.name}
                    </Text>
                    {friend.email && (
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                        {friend.email}
                      </Text>
                    )}
                  </Pressable>
                ))
              )}
            </View>

            {/* 分享備註 */}
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 8 /* internal spacing */ }}>
              分享備註（可選）
            </Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: `${colors.border}40`,
                borderRadius: 8,
                padding: 12,
                color: colors.foreground,
                backgroundColor: colors.surface,
                marginBottom: 16 /* internal spacing */,
                minHeight: 80,
                textAlignVertical: "top",
              }}
              placeholder="添加一些說明或感受..."
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              maxLength={200}
              multiline
            />

            {/* 權限設置 */}
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.foreground, marginBottom: 12 /* internal spacing */ }}>
              分享權限
            </Text>
            <View style={{ gap: 12, marginBottom: 16 /* internal spacing */ }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.foreground }}>允許評論</Text>
                <Switch
                  value={canComment}
                  onValueChange={setCanComment}
                  trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                  thumbColor={canComment ? colors.primary : colors.muted}
                />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  backgroundColor: colors.surface,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: colors.foreground }}>允許點讚</Text>
                <Switch
                  value={canLike}
                  onValueChange={setCanLike}
                  trackColor={{ false: colors.border, true: `${colors.primary}80` }}
                  thumbColor={canLike ? colors.primary : colors.muted}
                />
              </View>
            </View>
          </ScrollView>

          {/* 操作按鈕 */}
          <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
            <Pressable
              onPress={handleClose}
              disabled={isSharing}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: `${colors.border}20`,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: colors.foreground, fontWeight: "600" }}>取消</Text>
            </Pressable>
            <Pressable
              onPress={handleShare}
              disabled={isSharing || !selectedFriendId}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 8,
                backgroundColor: selectedFriendId && !isSharing ? colors.primary : colors.muted,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isSharing ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={{ color: colors.background, fontWeight: "600" }}>分享</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
