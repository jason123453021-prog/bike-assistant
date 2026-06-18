import { and, desc, eq, ne, or } from "drizzle-orm";
import { z } from "zod";
import { dwellEvents, friendships, locationShares, users } from "../drizzle/schema";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";

export const friendsRouter = router({
  /** 取得好友列表（已接受的好友） */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const uid = ctx.user.id;
    const rows = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, uid), eq(friendships.receiverId, uid))
        )
      );
    // 取得好友的用戶資訊
    const friendIds = rows.map((r) =>
      r.requesterId === uid ? r.receiverId : r.requesterId
    );
    if (friendIds.length === 0) return [];
    const friendUsers = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(...friendIds.map((id) => eq(users.id, id))));
    return friendUsers;
  }),

  /** 取得待處理的好友邀請（收到的） */
  pendingRequests: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const rows = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.receiverId, ctx.user.id),
          eq(friendships.status, "pending")
        )
      );
    if (rows.length === 0) return [];
    const requesterIds = rows.map((r) => r.requesterId);
    const requesters = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(or(...requesterIds.map((id) => eq(users.id, id))));
    return rows.map((r) => ({
      friendshipId: r.id,
      requester: requesters.find((u) => u.id === r.requesterId),
      createdAt: r.createdAt,
    }));
  }),

  /** 透過 Email 發送好友邀請 */
  sendRequestByEmail: protectedProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      // 找到目標用戶
      const targets = await db
        .select()
        .from(users)
        .where(eq(users.email, input.email))
        .limit(1);
      if (targets.length === 0) throw new Error("找不到該 Email 的用戶");
      const target = targets[0]!;
      if (target.id === ctx.user.id) throw new Error("不能加自己為好友");
      // 檢查是否已有關係
      const existing = await db
        .select()
        .from(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, ctx.user.id), eq(friendships.receiverId, target.id)),
            and(eq(friendships.requesterId, target.id), eq(friendships.receiverId, ctx.user.id))
          )
        )
        .limit(1);
      if (existing.length > 0) throw new Error("已有好友關係或邀請待處理");
      await db.insert(friendships).values({
        requesterId: ctx.user.id,
        receiverId: target.id,
        status: "pending",
      });
      return { success: true };
    }),

  /** 接受好友邀請 */
  acceptRequest: protectedProcedure
    .input(z.object({ friendshipId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(friendships)
        .set({ status: "accepted" })
        .where(
          and(
            eq(friendships.id, input.friendshipId),
            eq(friendships.receiverId, ctx.user.id),
            eq(friendships.status, "pending")
          )
        );
      return { success: true };
    }),

  /** 拒絕或刪除好友 */
  removeFriend: protectedProcedure
    .input(z.object({ friendId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");
      await db
        .update(friendships)
        .set({ status: "rejected" })
        .where(
          or(
            and(eq(friendships.requesterId, ctx.user.id), eq(friendships.receiverId, input.friendId)),
            and(eq(friendships.requesterId, input.friendId), eq(friendships.receiverId, ctx.user.id))
          )
        );
      return { success: true };
    }),

  /** 更新自己的即時位置（騎乘中定期呼叫） */
  updateMyLocation: protectedProcedure
    .input(
      z.object({
        latitude: z.number(),
        longitude: z.number(),
        speed: z.number().default(0),
        heading: z.number().default(0),
        altitude: z.number().default(0),
        isGhostMode: z.boolean().default(false),
        batteryLevel: z.number().int().min(-1).max(100).default(-1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const uid = ctx.user.id;
      // Upsert：若已有記錄則更新，否則新增
      const existing = await db
        .select({ id: locationShares.id })
        .from(locationShares)
        .where(eq(locationShares.userId, uid))
        .limit(1);
      if (existing.length > 0) {
        await db
          .update(locationShares)
          .set({
            latitude: String(input.latitude),
            longitude: String(input.longitude),
            speed: String(input.speed),
            heading: String(input.heading),
            altitude: String(input.altitude),
            isGhostMode: input.isGhostMode ? 1 : 0,
            batteryLevel: input.batteryLevel,
          })
          .where(eq(locationShares.userId, uid));
      } else {
        await db.insert(locationShares).values({
          userId: uid,
          latitude: String(input.latitude),
          longitude: String(input.longitude),
          speed: String(input.speed),
          heading: String(input.heading),
          altitude: String(input.altitude),
          isGhostMode: input.isGhostMode ? 1 : 0,
          batteryLevel: input.batteryLevel,
        });
      }
      return { success: true };
    }),

  /** 取得好友的即時位置（隊伍遙測） */
  getFriendsLocations: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const uid = ctx.user.id;
    // 取得已接受的好友 ID 列表
    const friendRows = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, uid), eq(friendships.receiverId, uid))
        )
      );
    const friendIds = friendRows.map((r) =>
      r.requesterId === uid ? r.receiverId : r.requesterId
    );
    if (friendIds.length === 0) return [];
    // 取得好友位置（非隱身模式、5 分鐘內更新過的）
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const locations = await db
      .select()
      .from(locationShares)
      .where(
        and(
          or(...friendIds.map((id) => eq(locationShares.userId, id))),
          eq(locationShares.isGhostMode, 0)
        )
      );
    // 過濾 5 分鐘內的位置
    const recentLocations = locations.filter(
      (l) => new Date(l.updatedAt) > fiveMinAgo
    );
    // 取得好友用戶資訊
    const friendUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(or(...friendIds.map((id) => eq(users.id, id))));
    return recentLocations.map((loc) => ({
      userId: loc.userId,
      name: friendUsers.find((u) => u.id === loc.userId)?.name ?? "好友",
      latitude: parseFloat(loc.latitude),
      longitude: parseFloat(loc.longitude),
      speed: parseFloat(loc.speed ?? "0"),
      heading: parseFloat(loc.heading ?? "0"),
      altitude: parseFloat(loc.altitude ?? "0"),
      batteryLevel: loc.batteryLevel ?? -1,
      updatedAt: loc.updatedAt,
    }));
  }),

  /** 記錄停留事件開始 */
  startDwell: protectedProcedure
    .input(z.object({ latitude: z.number(), longitude: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { id: -1 };
      // 先結束任何進行中的停留
      await db
        .update(dwellEvents)
        .set({ endedAt: new Date(), durationSec: 0 })
        .where(
          and(eq(dwellEvents.userId, ctx.user.id), eq(dwellEvents.endedAt, null as unknown as Date))
        );
      const result = await db.insert(dwellEvents).values({
        userId: ctx.user.id,
        latitude: String(input.latitude),
        longitude: String(input.longitude),
      });
      return { id: Number((result as unknown as { insertId: number }).insertId ?? 0) };
    }),

  /** 結束停留事件 */
  endDwell: protectedProcedure
    .input(z.object({ dwellId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { success: false };
      const rows = await db
        .select()
        .from(dwellEvents)
        .where(
          and(
            eq(dwellEvents.id, input.dwellId),
            eq(dwellEvents.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (rows.length === 0) return { success: false };
      const dwell = rows[0]!;
      const durationSec = Math.round(
        (Date.now() - new Date(dwell.startedAt).getTime()) / 1000
      );
      await db
        .update(dwellEvents)
        .set({ endedAt: new Date(), durationSec })
        .where(eq(dwellEvents.id, input.dwellId));
      return { success: true, durationSec };
    }),

  /** 取得好友的停留狀態（是否異常停留 > 5 分鐘） */
  getFriendsDwellStatus: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    const uid = ctx.user.id;
    const friendRows = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, "accepted"),
          or(eq(friendships.requesterId, uid), eq(friendships.receiverId, uid))
        )
      );
    const friendIds = friendRows.map((r) =>
      r.requesterId === uid ? r.receiverId : r.requesterId
    );
    if (friendIds.length === 0) return [];
    // 取得好友目前進行中的停留事件
    const activeDwells = await db
      .select()
      .from(dwellEvents)
      .where(
        and(
          or(...friendIds.map((id) => eq(dwellEvents.userId, id))),
          eq(dwellEvents.endedAt, null as unknown as Date)
        )
      );
    const friendUsers = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(or(...friendIds.map((id) => eq(users.id, id))));
    return activeDwells.map((d) => {
      const dwellSec = Math.round(
        (Date.now() - new Date(d.startedAt).getTime()) / 1000
      );
      return {
        userId: d.userId,
        name: friendUsers.find((u) => u.id === d.userId)?.name ?? "好友",
        latitude: parseFloat(d.latitude),
        longitude: parseFloat(d.longitude),
        dwellSec,
        isAbnormal: dwellSec > 300, // 超過 5 分鐘視為異常
      };
    });
  }),
});
