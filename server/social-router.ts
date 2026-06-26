/**
 * 社群互動 API 路由
 *
 * 功能：
 * - 管理騎乘記錄的按讚和評論
 * - 支援雲端備份和多設備同步
 * - 支援好友分享和互動
 */

import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { getDb } from "./db";
import { rideInteractions, rideComments } from "../drizzle/schema";

export const socialRouter = router({
  /**
   * 獲取騎乘記錄的互動數據（按讚、評論）
   */
  getInteractions: protectedProcedure
    .input(z.object({ rideId: z.string() }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 獲取按讚數據
        const likes = await db
          .select()
          .from(rideInteractions)
          .where(eq(rideInteractions.rideId, input.rideId));

        // 獲取評論數據
        const comments = await db
          .select()
          .from(rideComments)
          .where(eq(rideComments.rideId, input.rideId));

        // 檢查當前使用者是否已按讚
        const userLike = likes.find((l) => l.userId === ctx.user.id);

        return {
          rideId: input.rideId,
          likeCount: likes.filter((l) => l.isLiked === 1).length,
          isLiked: userLike?.isLiked === 1 ? true : false,
          comments: comments.map((c) => ({
            id: c.id.toString(),
            userId: c.userId,
            content: c.content,
            createdAt: c.createdAt.getTime(),
          })),
        };
      } catch (error) {
        console.error("[Social] 獲取互動數據失敗:", error);
        throw error;
      }
    }),

  /**
   * 切換按讚狀態
   */
  toggleLike: protectedProcedure
    .input(z.object({ rideId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 查找現有的按讚記錄
        const existing = await db
          .select()
          .from(rideInteractions)
          .where(
            and(
              eq(rideInteractions.userId, ctx.user.id),
              eq(rideInteractions.rideId, input.rideId)
            )
          );

        if (existing.length > 0) {
          // 切換按讚狀態
          const current = existing[0];
          const newStatus = current.isLiked === 1 ? 0 : 1;
          await db
            .update(rideInteractions)
            .set({ isLiked: newStatus })
            .where(eq(rideInteractions.id, current.id));
          return { isLiked: newStatus === 1 };
        } else {
          // 建立新的按讚記錄
          await db.insert(rideInteractions).values({
            userId: ctx.user.id,
            rideId: input.rideId,
            isLiked: 1,
          });
          return { isLiked: true };
        }
      } catch (error) {
        console.error("[Social] 切換按讚失敗:", error);
        throw error;
      }
    }),

  /**
   * 新增評論
   */
  addComment: protectedProcedure
    .input(
      z.object({
        rideId: z.string(),
        content: z.string().min(1).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        const result = await db.insert(rideComments).values({
          userId: ctx.user.id,
          rideId: input.rideId,
          content: input.content,
        });

        return {
          id: result[0].toString(),
          userId: ctx.user.id,
          content: input.content,
          createdAt: Date.now(),
        };
      } catch (error) {
        console.error("[Social] 新增評論失敗:", error);
        throw error;
      }
    }),

  /**
   * 刪除評論
   */
  deleteComment: protectedProcedure
    .input(z.object({ commentId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 驗證評論所有者
        const comment = await db
          .select()
          .from(rideComments)
          .where(eq(rideComments.id, input.commentId));

        if (comment.length === 0) {
          throw new Error("Comment not found");
        }

        if (comment[0].userId !== ctx.user.id) {
          throw new Error("Unauthorized to delete this comment");
        }

        await db
          .delete(rideComments)
          .where(eq(rideComments.id, input.commentId));

        return { success: true };
      } catch (error) {
        console.error("[Social] 刪除評論失敗:", error);
        throw error;
      }
    }),

  /**
   * 同步本地社群互動至後端
   * 用於離線模式下的本地數據上傳
   */
  syncInteractions: protectedProcedure
    .input(
      z.object({
        interactions: z.array(
          z.object({
            rideId: z.string(),
            isLiked: z.boolean(),
          })
        ),
        comments: z.array(
          z.object({
            rideId: z.string(),
            content: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // 同步按讚數據
        for (const interaction of input.interactions) {
          const existing = await db
            .select()
            .from(rideInteractions)
            .where(
              and(
                eq(rideInteractions.userId, ctx.user.id),
                eq(rideInteractions.rideId, interaction.rideId)
              )
            );

          if (existing.length > 0) {
            await db
              .update(rideInteractions)
              .set({ isLiked: interaction.isLiked ? 1 : 0 })
              .where(eq(rideInteractions.id, existing[0].id));
          } else {
            await db.insert(rideInteractions).values({
              userId: ctx.user.id,
              rideId: interaction.rideId,
              isLiked: interaction.isLiked ? 1 : 0,
            });
          }
        }

        // 同步評論數據
        for (const comment of input.comments) {
          await db.insert(rideComments).values({
            userId: ctx.user.id,
            rideId: comment.rideId,
            content: comment.content,
          });
        }

        return { success: true, synced: input.interactions.length + input.comments.length };
      } catch (error) {
        console.error("[Social] 同步互動失敗:", error);
        throw error;
      }
    }),
});
