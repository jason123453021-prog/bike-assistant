import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";

export default function FriendsScreen() {
  const colors = useColors();
  const { user, isAuthenticated } = useAuth();
  const [tab, setTab] = useState<"friends" | "requests" | "add">("friends");
  const [emailInput, setEmailInput] = useState("");
  const [showMyQR, setShowMyQR] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const friendsQuery = trpc.friends.list.useQuery(undefined, { enabled: isAuthenticated });
  const requestsQuery = trpc.friends.pendingRequests.useQuery(undefined, { enabled: isAuthenticated });
  const sendRequestMutation = trpc.friends.sendRequestByEmail.useMutation({
    onSuccess: () => {
      Alert.alert("成功", "好友邀請已發送");
      setEmailInput("");
    },
    onError: (e) => Alert.alert("錯誤", e.message),
  });
  const acceptMutation = trpc.friends.acceptRequest.useMutation({
    onSuccess: () => {
      requestsQuery.refetch();
      friendsQuery.refetch();
    },
    onError: (e) => Alert.alert("錯誤", e.message),
  });
  const removeMutation = trpc.friends.removeFriend.useMutation({
    onSuccess: () => friendsQuery.refetch(),
    onError: (e) => Alert.alert("錯誤", e.message),
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([friendsQuery.refetch(), requestsQuery.refetch()]);
    setRefreshing(false);
  }, [friendsQuery, requestsQuery]);

  const handleSendRequest = () => {
    const trimmed = emailInput.trim();
    if (!trimmed || !trimmed.includes("@")) {
      Alert.alert("錯誤", "請輸入有效的 Email");
      return;
    }
    sendRequestMutation.mutate({ email: trimmed });
  };

  const handleRemoveFriend = (friendId: number, name: string) => {
    Alert.alert("移除好友", `確定要移除 ${name}？`, [
      { text: "取消", style: "cancel" },
      {
        text: "移除",
        style: "destructive",
        onPress: () => removeMutation.mutate({ friendId }),
      },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="p-6">
        <View style={styles.notLoggedIn}>
          <IconSymbol name="person.2.fill" size={48} color={colors.muted} />
          <Text style={[styles.notLoggedInTitle, { color: colors.foreground }]}>需要登入</Text>
          <Text style={[styles.notLoggedInSub, { color: colors.muted }]}>
            請先登入帳號以使用好友功能
          </Text>
          <Pressable
            style={({ pressed }) => [styles.loginBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => router.back()}
          >
            <Text style={styles.loginBtnText}>返回設定登入</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer containerClassName="bg-background">
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => router.back()}
        >
          <IconSymbol name="arrow.left" size={22} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>好友管理</Text>
        <Pressable
          style={({ pressed }) => [styles.qrBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => setShowMyQR(true)}
        >
          <IconSymbol name="qrcode" size={22} color={colors.accent} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(["friends", "requests", "add"] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.tabItem, tab === t && { borderBottomColor: colors.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? colors.accent : colors.muted }]}>
              {t === "friends" ? `好友 (${friendsQuery.data?.length ?? 0})` :
               t === "requests" ? `邀請 ${requestsQuery.data && requestsQuery.data.length > 0 ? `(${requestsQuery.data.length})` : ""}` :
               "新增好友"}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* 好友列表 */}
        {tab === "friends" && (
          <>
            {friendsQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
            ) : friendsQuery.data?.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol name="person.2.fill" size={40} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>還沒有好友，去新增吧！</Text>
              </View>
            ) : (
              friendsQuery.data?.map((friend) => (
                <View key={friend.id} style={[styles.friendRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent + "30" }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {(friend.name ?? friend.email ?? "?")[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.friendName, { color: colors.foreground }]}>{friend.name ?? "未命名"}</Text>
                    <Text style={[styles.friendEmail, { color: colors.muted }]}>{friend.email ?? ""}</Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.removeBtn, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => handleRemoveFriend(friend.id, friend.name ?? "好友")}
                  >
                    <IconSymbol name="xmark" size={16} color={colors.error} />
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}

        {/* 待處理邀請 */}
        {tab === "requests" && (
          <>
            {requestsQuery.isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
            ) : requestsQuery.data?.length === 0 ? (
              <View style={styles.emptyState}>
                <IconSymbol name="bell.fill" size={40} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>沒有待處理的邀請</Text>
              </View>
            ) : (
              requestsQuery.data?.map((req) => (
                <View key={req.friendshipId} style={[styles.requestRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.warning + "30" }]}>
                    <Text style={[styles.avatarText, { color: colors.warning }]}>
                      {(req.requester?.name ?? req.requester?.email ?? "?")[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.friendName, { color: colors.foreground }]}>{req.requester?.name ?? "未命名"}</Text>
                    <Text style={[styles.friendEmail, { color: colors.muted }]}>{req.requester?.email ?? ""}</Text>
                  </View>
                  <View style={styles.requestBtns}>
                    <Pressable
                      style={({ pressed }) => [styles.acceptBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
                      onPress={() => acceptMutation.mutate({ friendshipId: req.friendshipId })}
                    >
                      <IconSymbol name="checkmark" size={16} color="#fff" />
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.rejectBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => removeMutation.mutate({ friendId: req.requester?.id ?? 0 })}
                    >
                      <IconSymbol name="xmark" size={16} color={colors.muted} />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </>
        )}

        {/* 新增好友 */}
        {tab === "add" && (
          <View style={styles.addSection}>
            <Text style={[styles.addTitle, { color: colors.foreground }]}>透過 Email 新增</Text>
            <Text style={[styles.addSub, { color: colors.muted }]}>
              輸入對方的帳號 Email，發送好友邀請
            </Text>
            <View style={[styles.emailInputRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <IconSymbol name="envelope.fill" size={18} color={colors.muted} />
              <TextInput
                style={[styles.emailInput, { color: colors.foreground }]}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder="輸入 Email..."
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                onSubmitEditing={handleSendRequest}
              />
            </View>
            <Pressable
              style={({ pressed }) => [styles.sendBtn, { backgroundColor: colors.accent, opacity: pressed || sendRequestMutation.isPending ? 0.7 : 1 }]}
              onPress={handleSendRequest}
              disabled={sendRequestMutation.isPending}
            >
              {sendRequestMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.sendBtnText}>發送邀請</Text>
              )}
            </Pressable>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <Text style={[styles.addTitle, { color: colors.foreground }]}>透過 QR Code 新增</Text>
            <Text style={[styles.addSub, { color: colors.muted }]}>
              掃描對方的 QR Code，或讓對方掃描你的 QR Code
            </Text>
            <Pressable
              style={({ pressed }) => [styles.qrShowBtn, { borderColor: colors.accent, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setShowMyQR(true)}
            >
              <IconSymbol name="qrcode" size={20} color={colors.accent} />
              <Text style={[styles.qrShowBtnText, { color: colors.accent }]}>顯示我的 QR Code</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      {/* 我的 QR Code Modal */}
      <Modal
        visible={showMyQR}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMyQR(false)}
      >
        <Pressable style={styles.qrOverlay} onPress={() => setShowMyQR(false)}>
          <View style={[styles.qrCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.qrTitle, { color: colors.foreground }]}>我的 QR Code</Text>
            <Text style={[styles.qrSub, { color: colors.muted }]}>讓好友掃描以發送好友邀請</Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={`bike-friend:${user?.email ?? user?.id ?? "unknown"}`}
                size={200}
                color={colors.foreground}
                backgroundColor={colors.surface}
              />
            </View>
            <Text style={[styles.qrEmail, { color: colors.muted }]}>{user?.email ?? user?.name ?? ""}</Text>
            <Pressable
              style={({ pressed }) => [styles.qrCloseBtn, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => setShowMyQR(false)}
            >
              <Text style={styles.qrCloseBtnText}>關閉</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  qrBtn: { padding: 4 },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabText: { fontSize: 14, fontWeight: "600" },
  content: { padding: 16, paddingBottom: 40 /* internal spacing */ },
  friendRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10 /* internal spacing */,
    gap: 12,
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 10 /* internal spacing */,
    gap: 12,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "700" },
  friendName: { fontSize: 15, fontWeight: "600" },
  friendEmail: { fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 8 },
  requestBtns: { flexDirection: "row", gap: 8 },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15 },
  addSection: { gap: 12 },
  addTitle: { fontSize: 17, fontWeight: "700", marginTop: 8 },
  addSub: { fontSize: 13, lineHeight: 18 },
  emailInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
  },
  emailInput: { flex: 1, fontSize: 15, paddingVertical: 12 },
  sendBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  sendBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  qrShowBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 8,
  },
  qrShowBtnText: { fontSize: 15, fontWeight: "600" },
  notLoggedIn: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  notLoggedInTitle: { fontSize: 22, fontWeight: "700" },
  notLoggedInSub: { fontSize: 15, textAlign: "center", lineHeight: 22 },
  loginBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14, marginTop: 8 },
  loginBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
  // QR Modal
  qrOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  qrCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  qrTitle: { fontSize: 20, fontWeight: "700" },
  qrSub: { fontSize: 13, textAlign: "center" },
  qrContainer: { padding: 16, borderRadius: 16, backgroundColor: "#fff" },
  qrEmail: { fontSize: 13 },
  qrCloseBtn: { paddingHorizontal: 40, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  qrCloseBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
