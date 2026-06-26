/**
 * 騎乘分享 API 路由
 *
 * 功能：
 * - 管理騎乘記錄分享至好友
 * - 支援分享評論和點讚
 * - 支援分享權限控制
 */

import { eq, and, or } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { rideShares, shareComments, shareLikes } from "../drizzle/schema";

export const shareRouter = router({
  /**
   * 分享騎乘記錄至好友
   */
  shareRide: protectedProcedure
    .input(
      z.object({
        rideId: z.string(),
        shareToUserId: z.number(),
        note: z.string().optional(),
        canComment: z.boolean().default(true),
        canLike: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 檢查是否已分享過
        const existing = await db
          .select()
          .from(rideShares)
          .where(
            and(
              eq(rideShares.shareFromUserId, ctx.user.id),
              eq(rideShares.shareToUserId, input.shareToUserId),
              eq(rideShares.rideId, input.rideId)
            )
          );

        if (existing.length > 0) {
          throw new Error("Already shared with this user");
        }

        const result = await db.insert(rideShares).values({
          shareFromUserId: ctx.user.id,
          shareToUserId: input.shareToUserId,
          rideId: input.rideId,
          note: input.note,
          canComment: input.canComment ? 1 : 0,
          canLike: input.canLike ? 1 : 0,
        });

        return { success: true, shareId: result[0] };
      } catch (error) {
        console.error("[Share] 分享失敗:", error);
        throw error;
      }
    }),

  /**
   * 獲取分享給我的騎乘記錄
   */
  getSharedWithMe: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const shares = await db
        .select()
        .from(rideShares)
        .where(eq(rideShares.shareToUserId, ctx.user.id));

      return shares.map((share) => ({
        id: share.id,
        rideId: share.rideId,
        shareFromUserId: share.shareFromUserId,
        note: share.note,
        canComment: share.canComment === 1,
        canLike: share.canLike === 1,
        createdAt: share.createdAt.getTime(),
      }));
    } catch (error) {
      console.error("[Share] 獲取分享記錄失敗:", error);
      throw error;
    }
  }),

  /**
   * 獲取我分享的騎乘記錄
   */
  getMyShares: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    try {
      const shares = await db
        .select()
        .from(rideShares)
        .where(eq(rideShares.shareFromUserId, ctx.user.id));

      return shares.map((share) => ({
        id: share.id,
        rideId: share.rideId,
        shareToUserId: share.shareToUserId,
        note: share.note,
        canComment: share.canComment === 1,
        canLike: share.canLike === 1,
        createdAt: share.createdAt.getTime(),
      }));
    } catch (error) {
      console.error("[Share] 獲取我的分享失敗:", error);
      throw error;
    }
  }),

  /**
   * 取消分享
   */
  unshareRide: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 驗證分享所有者
        const share = await db
          .select()
          .from(rideShares)
          .where(eq(rideShares.id, input.shareId));

        if (share.length === 0) {
          throw new Error("Share not found");
        }

        if (share[0].shareFromUserId !== ctx.user.id) {
          throw new Error("Unauthorized to delete this share");
        }

        // 刪除相關的評論和點讚
        await db.delete(shareComments).where(eq(shareComments.shareId, input.shareId));
        await db.delete(shareLikes).where(eq(shareLikes.shareId, input.shareId));

        // 刪除分享記錄
        await db.delete(rideShares).where(eq(rideShares.id, input.shareId));

        return { success: true };
      } catch (error) {
        console.error("[Share] 取消分享失敗:", error);
        throw error;
      }
    }),

  /**
   * 在分享上添加評論
   */
  addShareComment: protectedProcedure
    .input(
      z.object({
        shareId: z.number(),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 驗證分享是否存在且允許評論
        const share = await db
          .select()
          .from(rideShares)
          .where(eq(rideShares.id, input.shareId));

        if (share.length === 0) {
          throw new Error("Share not found");
        }

        if (share[0].canComment === 0) {
          throw new Error("Comments not allowed on this share");
        }

        const result = await db.insert(shareComments).values({
          shareId: input.shareId,
          userId: ctx.user.id,
          content: input.content,
        });

        return {
          id: result[0],
          userId: ctx.user.id,
          content: input.content,
          createdAt: Date.now(),
        };
      } catch (error) {
        console.error("[Share] 添加評論失敗:", error);
        throw error;
      }
    }),

  /**
   * 獲取分享上的評論
   */
  getShareComments: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        const comments = await db
          .select()
          .from(shareComments)
          .where(eq(shareComments.shareId, input.shareId));

        return comments.map((comment) => ({
          id: comment.id,
          userId: comment.userId,
          content: comment.content,
          createdAt: comment.createdAt.getTime(),
        }));
      } catch (error) {
        console.error("[Share] 獲取評論失敗:", error);
        throw error;
      }
    }),

  /**
   * 在分享上點讚
   */
  toggleShareLike: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 驗證分享是否存在且允許點讚
        const share = await db
          .select()
          .from(rideShares)
          .where(eq(rideShares.id, input.shareId));

        if (share.length === 0) {
          throw new Error("Share not found");
        }

        if (share[0].canLike === 0) {
          throw new Error("Likes not allowed on this share");
        }

        // 檢查是否已點讚
        const existing = await db
          .select()
          .from(shareLikes)
          .where(
            and(
              eq(shareLikes.shareId, input.shareId),
              eq(shareLikes.userId, ctx.user.id)
            )
          );

        if (existing.length > 0) {
          // 取消點讚
          await db
            .delete(shareLikes)
            .where(
              and(
                eq(shareLikes.shareId, input.shareId),
                eq(shareLikes.userId, ctx.user.id)
              )
            );
          return { isLiked: false };
        } else {
          // 添加點讚
          await db.insert(shareLikes).values({
            shareId: input.shareId,
            userId: ctx.user.id,
          });
          return { isLiked: true };
        }
      } catch (error) {
        console.error("[Share] 點讚失敗:", error);
        throw error;
      }
    }),

  /**
   * 獲取分享的點讚數和當前用戶是否已點讚
   */
  getShareLikes: protectedProcedure
    .input(z.object({ shareId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        const likes = await db
          .select()
          .from(shareLikes)
          .where(eq(shareLikes.shareId, input.shareId));

        const userLike = likes.find((l) => l.userId === ctx.user.id);

        return {
          likeCount: likes.length,
          isLiked: !!userLike,
        };
      } catch (error) {
        console.error("[Share] 獲取點讚失敗:", error);
        throw error;
      }
    }),
});
