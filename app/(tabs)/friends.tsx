import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  ScrollView,
} from "react-native";
import * as Location from "expo-location";
import { ScreenContainer } from "@/components/screen-container";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { useColors } from "@/hooks/use-colors";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/lib/trpc";
import { fetchWeather, WeatherData } from "@/lib/weather-service";
import { fetchBikeRoute } from "@/lib/route-service";

// ── Haversine 距離計算 ──────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// ── 天氣圖示 ──────────────────────────────────────────────────────────────
function weatherIcon(code: number): string {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 67) return "🌧️";
  if (code <= 77) return "❄️";
  if (code <= 82) return "🌦️";
  return "⛈️";
}

// ── 好友詳細資訊 Modal ────────────────────────────────────────────────────
interface FriendLocation {
  userId: number;
  name: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  altitude: number;
  updatedAt: string | Date;
}

interface FriendDetailModalProps {
  friend: { id: number; name: string | null; email: string | null };
  location: FriendLocation | null;
  myPos: { lat: number; lon: number } | null;
  onClose: () => void;
  onNavigateBike: () => void;
  onNavigateRoad: () => void;
  colors: ReturnType<typeof useColors>;
}

function FriendDetailModal({
  friend,
  location,
  myPos,
  onClose,
  onNavigateBike,
  onNavigateRoad,
  colors,
}: FriendDetailModalProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  React.useEffect(() => {
    if (location) {
      setWeatherLoading(true);
      fetchWeather(location.latitude, location.longitude)
        .then((w) => setWeather(w))
        .finally(() => setWeatherLoading(false));
    }
  }, [location?.latitude, location?.longitude]);

  const distance =
    myPos && location ? haversine(myPos.lat, myPos.lon, location.latitude, location.longitude) : null;

  const speedKmh = location ? Math.round(location.speed * 3.6) : null;
  const isMoving = speedKmh !== null && speedKmh > 2;

  const lastSeen = location
    ? (() => {
        const diff = Math.round((Date.now() - new Date(location.updatedAt).getTime()) / 1000);
        if (diff < 60) return `${diff} 秒前`;
        if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
        return `${Math.floor(diff / 3600)} 小時前`;
      })()
    : null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose} />
      <View style={[styles.detailSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* 標題列 */}
        <View style={styles.detailHeader}>
          <View style={[styles.detailAvatar, { backgroundColor: colors.accent }]}>
            <Text style={styles.detailAvatarText}>{(friend.name ?? "?").charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.detailName, { color: colors.foreground }]}>{friend.name ?? "未命名"}</Text>
            <Text style={[styles.detailEmail, { color: colors.muted }]}>{friend.email ?? ""}</Text>
          </View>
          <Pressable onPress={onClose} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
            <IconSymbol name="xmark" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {location ? (
            <>
              {/* 狀態列 */}
              <View style={[styles.statusRow, { backgroundColor: colors.background }]}>
                <View style={styles.statusItem}>
                  <Text style={[styles.statusLabel, { color: colors.muted }]}>狀態</Text>
                  <Text style={[styles.statusValue, { color: isMoving ? colors.success : colors.warning }]}>
                    {isMoving ? "🚴 騎行中" : "⏸ 停留中"}
                  </Text>
                </View>
                <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statusItem}>
                  <Text style={[styles.statusLabel, { color: colors.muted }]}>時速</Text>
                  <Text style={[styles.statusValue, { color: colors.foreground }]}>
                    {speedKmh} <Text style={{ fontSize: 12 }}>km/h</Text>
                  </Text>
                </View>
                <View style={[styles.statusDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statusItem}>
                  <Text style={[styles.statusLabel, { color: colors.muted }]}>距離</Text>
                  <Text style={[styles.statusValue, { color: colors.foreground }]}>
                    {distance !== null ? formatDist(distance) : "—"}
                  </Text>
                </View>
              </View>

              {/* 最後更新 */}
              <Text style={[styles.lastSeen, { color: colors.muted }]}>位置更新：{lastSeen}</Text>

              {/* 天氣卡片 */}
              <View style={[styles.weatherCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.weatherTitle, { color: colors.muted }]}>📍 好友所在地天氣</Text>
                {weatherLoading ? (
                  <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: 8 }} />
                ) : weather ? (
                  <View style={styles.weatherGrid}>
                    <View style={styles.weatherItem}>
                      <Text style={styles.weatherIcon}>{weatherIcon(weather.weatherCode)}</Text>
                      <Text style={[styles.weatherValue, { color: colors.foreground }]}>{weather.description}</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Text style={styles.weatherIcon}>🌡️</Text>
                      <Text style={[styles.weatherValue, { color: colors.foreground }]}>{weather.temperature}°C</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Text style={styles.weatherIcon}>💧</Text>
                      <Text style={[styles.weatherValue, { color: colors.foreground }]}>{weather.humidity}%</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Text style={styles.weatherIcon}>💨</Text>
                      <Text style={[styles.weatherValue, { color: colors.foreground }]}>{weather.windSpeed} km/h</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Text style={styles.weatherIcon}>🌂</Text>
                      <Text style={[styles.weatherValue, { color: colors.foreground }]}>{weather.precipitationProb}%</Text>
                    </View>
                  </View>
                ) : (
                  <Text style={[styles.weatherValue, { color: colors.muted }]}>無法取得天氣資訊</Text>
                )}
              </View>

              {/* 導航按鈕 */}
              <Text style={[styles.navTitle, { color: colors.muted }]}>導航前往好友位置</Text>
              <View style={styles.navRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.navBtn,
                    { backgroundColor: colors.success, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => { onClose(); onNavigateBike(); }}
                >
                  <Text style={styles.navBtnIcon}>🚴</Text>
                  <Text style={styles.navBtnText}>自行車道優先</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.navBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => { onClose(); onNavigateRoad(); }}
                >
                  <Text style={styles.navBtnIcon}>🛣️</Text>
                  <Text style={styles.navBtnText}>一般道路優先</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.offlineBox}>
              <Text style={{ fontSize: 36 }}>📵</Text>
              <Text style={[styles.offlineText, { color: colors.muted }]}>
                好友目前不在線上或未開啟位置分享
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── 主頁面 ────────────────────────────────────────────────────────────────
export default function FriendsScreen() {
  const colors = useColors();
  const { isAuthenticated } = useAuth();

  // 新增好友 input
  const [addEmail, setAddEmail] = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // 選中的好友（顯示詳細 Modal）
  const [selectedFriend, setSelectedFriend] = useState<{
    id: number; name: string | null; email: string | null;
  } | null>(null);

  // 我的位置
  const [myPos, setMyPos] = useState<{ lat: number; lon: number } | null>(null);

  // tRPC queries
  const friendsQuery = trpc.friends.list.useQuery(undefined, { enabled: isAuthenticated });
  const pendingQuery = trpc.friends.pendingRequests.useQuery(undefined, { enabled: isAuthenticated });
  const locationsQuery = trpc.friends.getFriendsLocations.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 10000, // 每 10 秒更新一次
  });

  // tRPC mutations
  const sendRequest = trpc.friends.sendRequestByEmail.useMutation();
  const acceptRequest = trpc.friends.acceptRequest.useMutation();
  const removeFriend = trpc.friends.removeFriend.useMutation();

  // 取得我的位置
  React.useEffect(() => {
    Location.getLastKnownPositionAsync().then((loc) => {
      if (loc) setMyPos({ lat: loc.coords.latitude, lon: loc.coords.longitude });
    });
  }, []);

  // 新增好友
  const handleAddFriend = useCallback(async () => {
    const email = addEmail.trim();
    if (!email) return;
    setAddLoading(true);
    try {
      await sendRequest.mutateAsync({ email });
      setAddEmail("");
      Alert.alert("已發送", `好友邀請已發送至 ${email}`);
    } catch (e: any) {
      Alert.alert("發送失敗", e?.message ?? "請確認 Email 是否正確");
    } finally {
      setAddLoading(false);
    }
  }, [addEmail, sendRequest]);

  // 接受邀請
  const handleAccept = useCallback(async (friendshipId: number) => {
    try {
      await acceptRequest.mutateAsync({ friendshipId });
      pendingQuery.refetch();
      friendsQuery.refetch();
    } catch (e: any) {
      Alert.alert("錯誤", e?.message);
    }
  }, [acceptRequest, pendingQuery, friendsQuery]);

  // 刪除好友
  const handleRemove = useCallback((friendId: number, name: string | null) => {
    Alert.alert("刪除好友", `確定要刪除好友「${name ?? "未命名"}」？`, [
      { text: "取消", style: "cancel" },
      {
        text: "刪除", style: "destructive",
        onPress: async () => {
          try {
            await removeFriend.mutateAsync({ friendId });
            friendsQuery.refetch();
          } catch (e: any) {
            Alert.alert("錯誤", e?.message);
          }
        },
      },
    ]);
  }, [removeFriend, friendsQuery]);

  // 找到選中好友的位置資訊
  const selectedLocation = selectedFriend
    ? (locationsQuery.data ?? []).find((l) => l.userId === selectedFriend.id) ?? null
    : null;

  // 導航到好友位置（開啟地圖 tab 並傳遞目的地）
  const handleNavigate = useCallback(async (mode: "bike" | "road") => {
    if (!selectedLocation) {
      Alert.alert("無法導航", "好友目前不在線上");
      return;
    }
    if (!myPos) {
      Alert.alert("無法導航", "無法取得您的位置");
      return;
    }
    try {
      const dest = { latitude: selectedLocation.latitude, longitude: selectedLocation.longitude };
      const origin = { latitude: myPos.lat, longitude: myPos.lon };
      if (mode === "bike") {
        await fetchBikeRoute(origin, dest, true);
      } else {
        await fetchBikeRoute(origin, dest, false);
      }
      Alert.alert(
        "導航已規劃",
        `已規劃${mode === "bike" ? "自行車道優先" : "一般道路優先"}路線至 ${selectedLocation.name}，請前往導航頁面查看。`,
        [{ text: "確定" }]
      );
    } catch {
      Alert.alert("路線規劃失敗", "請稍後再試");
    }
  }, [selectedLocation, myPos]);

  if (!isAuthenticated) {
    return (
      <ScreenContainer className="items-center justify-center p-6">
        <Text style={{ fontSize: 48 }}>🔒</Text>
        <Text style={[styles.emptyTitle, { color: colors.foreground }]}>請先登入</Text>
        <Text style={[styles.emptyHint, { color: colors.muted }]}>登入帳號後即可使用好友功能</Text>
      </ScreenContainer>
    );
  }

  const friends = friendsQuery.data ?? [];
  const pending = pendingQuery.data ?? [];
  const locations = locationsQuery.data ?? [];

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* 標題 */}
        <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.foreground }]}>好友</Text>
          <Text style={[styles.pageCount, { color: colors.muted }]}>{friends.length} 位好友</Text>
        </View>

        {/* 新增好友 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>新增好友</Text>
          <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="person.badge.plus" size={18} color={colors.muted} />
            <TextInput
              style={[styles.addInput, { color: colors.foreground }]}
              placeholder="輸入好友的 Email"
              placeholderTextColor={colors.muted}
              value={addEmail}
              onChangeText={setAddEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="send"
              onSubmitEditing={handleAddFriend}
            />
            <Pressable
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: colors.accent, opacity: pressed || addLoading ? 0.7 : 1 },
              ]}
              onPress={handleAddFriend}
              disabled={addLoading}
            >
              {addLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.addBtnText}>發送</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* 待處理邀請 */}
        {pending.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.muted }]}>
              待處理邀請 ({pending.length})
            </Text>
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {pending.map((req, idx) => (
                <View key={req.friendshipId}>
                  {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                  <View style={styles.pendingRow}>
                    <View style={[styles.smallAvatar, { backgroundColor: colors.warning + "44" }]}>
                      <Text style={{ fontSize: 14 }}>👤</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.friendName, { color: colors.foreground }]}>
                        {req.requester?.name ?? "未命名"}
                      </Text>
                      <Text style={[styles.friendEmail, { color: colors.muted }]}>
                        {req.requester?.email ?? ""}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [
                        styles.acceptBtn,
                        { backgroundColor: colors.success, opacity: pressed ? 0.7 : 1 },
                      ]}
                      onPress={() => handleAccept(req.friendshipId)}
                    >
                      <Text style={styles.acceptBtnText}>接受</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 好友列表 */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.muted }]}>好友列表</Text>
          {friendsQuery.isLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 20 }} />
          ) : friends.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={{ fontSize: 40 }}>🚴</Text>
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>尚無好友</Text>
              <Text style={[styles.emptyHint, { color: colors.muted }]}>
                輸入好友的 Email 發送邀請
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {friends.map((friend, idx) => {
                const loc = locations.find((l) => l.userId === friend.id);
                const dist = myPos && loc
                  ? haversine(myPos.lat, myPos.lon, loc.latitude, loc.longitude)
                  : null;
                const isOnline = !!loc;
                const speedKmh = loc ? Math.round(loc.speed * 3.6) : null;

                return (
                  <View key={friend.id}>
                    {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
                    <Pressable
                      style={({ pressed }) => [styles.friendRow, { opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => setSelectedFriend(friend)}
                    >
                      {/* 頭像 */}
                      <View style={[styles.friendAvatar, { backgroundColor: colors.accent + "33" }]}>
                        <Text style={[styles.friendAvatarText, { color: colors.accent }]}>
                          {(friend.name ?? "?").charAt(0).toUpperCase()}
                        </Text>
                        {/* 在線指示點 */}
                        <View
                          style={[
                            styles.onlineDot,
                            { backgroundColor: isOnline ? colors.success : colors.border },
                          ]}
                        />
                      </View>

                      {/* 資訊 */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.friendName, { color: colors.foreground }]}>
                          {friend.name ?? "未命名"}
                        </Text>
                        <Text style={[styles.friendEmail, { color: colors.muted }]}>
                          {isOnline
                            ? `${speedKmh} km/h${dist !== null ? ` · ${formatDist(dist)}` : ""}`
                            : "離線"}
                        </Text>
                      </View>

                      {/* 右側 */}
                      <View style={styles.friendRight}>
                        {isOnline && (
                          <View style={[styles.onlineBadge, { backgroundColor: colors.success + "22" }]}>
                            <Text style={[styles.onlineBadgeText, { color: colors.success }]}>在線</Text>
                          </View>
                        )}
                        <IconSymbol name="chevron.right" size={14} color={colors.muted} />
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* 好友詳細 Modal */}
      {selectedFriend && (
        <FriendDetailModal
          friend={selectedFriend}
          location={selectedLocation}
          myPos={myPos}
          onClose={() => setSelectedFriend(null)}
          onNavigateBike={() => handleNavigate("bike")}
          onNavigateRoad={() => handleNavigate("road")}
          colors={colors}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 28, fontWeight: "700" },
  pageCount: { fontSize: 14 },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  // 新增好友
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  addInput: { flex: 1, fontSize: 15, paddingVertical: 4 },
  addBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // 卡片
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },
  // 待處理邀請
  pendingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  smallAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  acceptBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  acceptBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  // 好友列表
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  friendAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  friendAvatarText: { fontSize: 18, fontWeight: "700" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "transparent",
  },
  friendName: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  friendEmail: { fontSize: 12 },
  friendRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  onlineBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  onlineBadgeText: { fontSize: 11, fontWeight: "600" },
  // 空狀態
  emptyBox: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyHint: { fontSize: 14, textAlign: "center" },
  // ── 詳細 Modal ──
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  detailSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: "85%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  detailHeader: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 16 },
  detailAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  detailAvatarText: { fontSize: 20, fontWeight: "700", color: "#fff" },
  detailName: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  detailEmail: { fontSize: 13 },
  // 狀態列
  statusRow: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  statusItem: { flex: 1, alignItems: "center", gap: 4 },
  statusLabel: { fontSize: 11, fontWeight: "600" },
  statusValue: { fontSize: 18, fontWeight: "700" },
  statusDivider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  lastSeen: { fontSize: 11, textAlign: "center", marginBottom: 14 },
  // 天氣卡片
  weatherCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 16,
  },
  weatherTitle: { fontSize: 12, fontWeight: "600", marginBottom: 10 },
  weatherGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  weatherItem: { alignItems: "center", minWidth: 56, gap: 4 },
  weatherIcon: { fontSize: 22 },
  weatherValue: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  // 導航
  navTitle: { fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  navRow: { flexDirection: "row", gap: 10 },
  navBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  navBtnIcon: { fontSize: 18 },
  navBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // 離線
  offlineBox: { alignItems: "center", paddingVertical: 32, gap: 10 },
  offlineText: { fontSize: 14, textAlign: "center" },
});
