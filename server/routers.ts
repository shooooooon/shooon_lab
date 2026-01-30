import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";

// Admin check middleware
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

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
    list: publicProcedure
      .input(z.object({
        status: z.enum(["draft", "published", "archived"]).optional(),
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
          status: input?.status ?? "published" as const,
        };
        return db.getArticles(options);
      }),
    
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
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const article = await db.getArticleById(input.id);
        if (!article) return null;
        
        const [articleTags, author, articleSeries] = await Promise.all([
          db.getArticleTags(article.id),
          db.getUserById(article.authorId),
          article.seriesId ? db.getSeriesById(article.seriesId) : null,
        ]);
        
        return { ...article, tags: articleTags, author, series: articleSeries };
      }),
    
    getBySlug: publicProcedure
      .input(z.object({ slug: z.string(), incrementView: z.boolean().default(false) }))
      .query(async ({ input }) => {
        const article = await db.getArticleBySlug(input.slug);
        if (!article) return null;
        
        if (input.incrementView && article.status === "published") {
          await db.incrementViewCount(article.id);
        }
        
        const [articleTags, author, articleSeries] = await Promise.all([
          db.getArticleTags(article.id),
          db.getUserById(article.authorId),
          article.seriesId ? db.getSeriesById(article.seriesId) : null,
        ]);
        
        return { ...article, tags: articleTags, author, series: articleSeries };
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
        
        // 公開時にpublishedAtを設定
        const article = await db.getArticleById(id);
        if (article && data.status === "published" && article.status !== "published") {
          (data as any).publishedAt = new Date();
        }
        
        await db.updateArticle(id, data);
        
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
    listByArticle: publicProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        const commentsList = await db.getCommentsByArticle(input.articleId, false);
        
        // コメント作成者情報を取得
        const commentsWithAuthor = await Promise.all(
          commentsList.map(async (comment) => {
            const author = await db.getUserById(comment.authorId);
            return { ...comment, author };
          })
        );
        
        return commentsWithAuthor;
      }),
    
    listByArticleAdmin: adminProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        const commentsList = await db.getCommentsByArticle(input.articleId, true);
        
        const commentsWithAuthor = await Promise.all(
          commentsList.map(async (comment) => {
            const author = await db.getUserById(comment.authorId);
            return { ...comment, author };
          })
        );
        
        return commentsWithAuthor;
      }),
    
    listPending: adminProcedure.query(async () => {
      const commentsList = await db.getPendingComments();
      
      const commentsWithDetails = await Promise.all(
        commentsList.map(async (comment) => {
          const [author, article] = await Promise.all([
            db.getUserById(comment.authorId),
            db.getArticleById(comment.articleId),
          ]);
          return { ...comment, author, article };
        })
      );
      
      return commentsWithDetails;
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
