import { z } from "zod";
import { sql } from "drizzle-orm";
import { notifyOwner } from "./notification";
import { adminProcedure, publicProcedure, router } from "./trpc";
import { getDbOrNull } from "../db";

export const systemRouter = router({
  // P10: ヘルスチェックDB疎通確認
  health: publicProcedure
    .input(
      z.object({
        timestamp: z.number().min(0, "timestamp cannot be negative"),
      })
    )
    .query(async () => {
      const db = getDbOrNull();
      if (!db) {
        return { ok: false, db: false };
      }
      try {
        await db.execute(sql`SELECT 1`);
        return { ok: true, db: true };
      } catch {
        return { ok: false, db: false };
      }
    }),

  notifyOwner: adminProcedure
    .input(
      z.object({
        title: z.string().min(1, "title is required"),
        content: z.string().min(1, "content is required"),
      })
    )
    .mutation(async ({ input }) => {
      const delivered = await notifyOwner(input);
      return {
        success: delivered,
      } as const;
    }),
});
