import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── 好友系統 ──────────────────────────────────────────────────────────────
/** 好友關係表：雙向確認制，status=pending 等待對方接受 */
export const friendships = mysqlTable("friendships", {
  id: int("id").autoincrement().primaryKey(),
  requesterId: int("requesterId").notNull(),   // 發送邀請的用戶
  receiverId: int("receiverId").notNull(),     // 接收邀請的用戶
  status: mysqlEnum("status", ["pending", "accepted", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Friendship = typeof friendships.$inferSelect;
export type InsertFriendship = typeof friendships.$inferInsert;

/** 即時位置分享表：騎乘中推播自己的位置，供好友查看 */
export const locationShares = mysqlTable("locationShares", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  speed: text("speed").default("0"),           // km/h
  heading: text("heading").default("0"),        // degrees
  altitude: text("altitude").default("0"),      // meters
  isGhostMode: int("isGhostMode").default(0).notNull(), // 1=隱身，不顯示給好友
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LocationShare = typeof locationShares.$inferSelect;
export type InsertLocationShare = typeof locationShares.$inferInsert;

/** 停留偵測表：記錄成員在某點的停留時間 */
export const dwellEvents = mysqlTable("dwellEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),               // null = 仍在停留中
  durationSec: int("durationSec"),             // 停留秒數（結束後填入）
});
export type DwellEvent = typeof dwellEvents.$inferSelect;
export type InsertDwellEvent = typeof dwellEvents.$inferInsert;
