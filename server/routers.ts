import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ========== Series API ==========
  series: router({
    list: publicProcedure.query(async () => {
      return db.getAllSeries();
    }),
    
    listWithCount: publicProcedure.query(async () => {
      return db.getSeriesWithCount();
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getSeriesById(input.id);
      }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return db.getSeriesBySlug(input.slug);
      }),
    
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1).max(128),
        title: z.string().min(1).max(256),
        description: z.string().optional(),
        coverImage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createSeries(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().min(1).max(128).optional(),
        title: z.string().min(1).max(256).optional(),
        description: z.string().optional(),
        coverImage: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateSeries(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteSeries(input.id);
        return { success: true };
      }),
  }),

  // ========== Tags API ==========
  tags: router({
    list: publicProcedure.query(async () => {
      return db.getAllTags();
    }),
    
    listWithCount: publicProcedure.query(async () => {
      return db.getTagsWithCount();
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getTagById(input.id);
      }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ input }) => {
        return db.getTagBySlug(input.slug);
      }),
    
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1).max(128),
        name: z.string().min(1).max(128),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        return db.createTag(input);
      }),
    
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().min(1).max(128).optional(),
        name: z.string().min(1).max(128).optional(),
        color: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateTag(id, data);
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTag(input.id);
        return { success: true };
      }),
  }),

  // ========== Articles API ==========
  articles: router({
    // #17: 公開APIではstatusパラメータを受け付けず、常にpublishedのみ返す
    list: publicProcedure
      .input(z.object({
        tagId: z.number().optional(),
        seriesId: z.number().optional(),
        year: z.number().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        orderBy: z.enum(["newest", "oldest", "weight"]).default("newest"),
      }).optional())
      .query(async ({ input }) => {
        const options = {
          ...input,
          status: "published" as const, // 常に公開記事のみ
        };
        return db.getArticles(options);
      }),
    
    // 管理者用: 全ステータスの記事を取得可能
    listAll: adminProcedure
      .input(z.object({
        status: z.enum(["draft", "published", "archived"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional())
      .query(async ({ input }) => {
        return db.getArticles(input ?? {});
      }),
    
    featured: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(10).default(5) }).optional())
      .query(async ({ input }) => {
        return db.getFeaturedArticles(input?.limit ?? 5);
      }),
    
    // #1: 未公開記事のアクセス制御 - 管理者以外は公開記事のみ閲覧可能
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const article = await db.getArticleById(input.id);
        if (!article) return null;
        
        // 管理者以外は公開記事のみ閲覧可能
        if (article.status !== "published" && ctx.user?.role !== "admin") {
          return null;
        }
        
        const [articleTags, author, articleSeries] = await Promise.all([
          db.getArticleTags(article.id),
          db.getUserById(article.authorId),
          article.seriesId ? db.getSeriesById(article.seriesId) : null,
        ]);
        
        return { ...article, tags: articleTags, author, series: articleSeries };
      }),
    
    // #1: 未公開記事のアクセス制御
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string() }))
      .query(async ({ ctx, input }) => {
        const article = await db.getArticleBySlug(input.slug);
        if (!article) return null;
        
        // 管理者以外は公開記事のみ閲覧可能
        if (article.status !== "published" && ctx.user?.role !== "admin") {
          return null;
        }
        
        const [articleTags, author, articleSeries] = await Promise.all([
          db.getArticleTags(article.id),
          db.getUserById(article.authorId),
          article.seriesId ? db.getSeriesById(article.seriesId) : null,
        ]);
        
        return { ...article, tags: articleTags, author, series: articleSeries };
      }),
    
    // #2: ビューカウントのインクリメントを別のmutationに分離
    incrementView: publicProcedure
      .input(z.object({ slug: z.string() }))
      .mutation(async ({ input }) => {
        const article = await db.getArticleBySlug(input.slug);
        if (article && article.status === "published") {
          await db.incrementViewCount(article.id);
        }
        return { success: true };
      }),
    
    create: adminProcedure
      .input(z.object({
        slug: z.string().min(1).max(256),
        title: z.string().min(1).max(512),
        excerpt: z.string().optional(),
        content: z.string().min(1),
        coverImage: z.string().optional(),
        seriesId: z.number().optional(),
        seriesOrder: z.number().optional(),
        weight: z.number().default(0),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
        gallery: z.array(z.string()).optional(),
        footnotes: z.array(z.object({ id: z.string(), content: z.string() })).optional(),
        tagIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { tagIds, ...articleData } = input;
        
        const data = {
          ...articleData,
          authorId: ctx.user.id,
          publishedAt: input.status === "published" ? new Date() : undefined,
        };
        
        const result = await db.createArticle(data);
        
        if (tagIds && tagIds.length > 0) {
          await db.setArticleTags(result.id, tagIds);
        }
        
        return result;
      }),
    
    // #3: as anyの型キャストを修正
    update: adminProcedure
      .input(z.object({
        id: z.number(),
        slug: z.string().min(1).max(256).optional(),
        title: z.string().min(1).max(512).optional(),
        excerpt: z.string().optional(),
        content: z.string().optional(),
        coverImage: z.string().optional(),
        seriesId: z.number().nullable().optional(),
        seriesOrder: z.number().nullable().optional(),
        weight: z.number().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        gallery: z.array(z.string()).optional(),
        footnotes: z.array(z.object({ id: z.string(), content: z.string() })).optional(),
        tagIds: z.array(z.number()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, tagIds, ...data } = input;
        
        // 公開時にpublishedAtを設定（型安全に）
        const article = await db.getArticleById(id);
        const updateData = {
          ...data,
          ...(data.status === "published" && article?.status !== "published"
            ? { publishedAt: new Date() }
            : {}),
        };
        
        await db.updateArticle(id, updateData);
        
        if (tagIds !== undefined) {
          await db.setArticleTags(id, tagIds);
        }
        
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteArticle(input.id);
        return { success: true };
      }),
  }),

  // ========== Comments API ==========
  comments: router({
    // #6: N+1クエリ問題を解決 - JOINで一括取得
    listByArticle: publicProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        return db.getCommentsByArticleWithAuthor(input.articleId, false);
      }),
    
    listByArticleAdmin: adminProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        return db.getCommentsByArticleWithAuthor(input.articleId, true);
      }),
    
    listPending: adminProcedure.query(async () => {
      return db.getPendingCommentsWithDetails();
    }),
    
    create: protectedProcedure
      .input(z.object({
        articleId: z.number(),
        content: z.string().min(1).max(5000),
        parentId: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // 管理者のコメントは自動承認
        const status = ctx.user.role === "admin" ? "approved" : "pending";
        
        return db.createComment({
          ...input,
          authorId: ctx.user.id,
          status,
        });
      }),
    
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateCommentStatus(input.id, "approved");
        return { success: true };
      }),
    
    reject: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.updateCommentStatus(input.id, "rejected");
        return { success: true };
      }),
    
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteComment(input.id);
        return { success: true };
      }),
  }),

  // ========== Archive API ==========
  archive: router({
    years: publicProcedure.query(async () => {
      return db.getArchiveYears();
    }),
  }),
});

export type AppRouter = typeof appRouter;
