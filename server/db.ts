import { eq, desc, asc, and, or, like, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  articles, InsertArticle, Article,
  tags, InsertTag, Tag,
  series, InsertSeries, Series,
  comments, InsertComment, Comment,
  articleTags, InsertArticleTag
} from "../drizzle/schema";
import { ENV } from './_core/env';

// #12: DB初期化パターンの改善 - モジュールレベルで初期化
const db = process.env.DATABASE_URL ? drizzle(process.env.DATABASE_URL) : null;

function requireDb() {
  if (!db) throw new Error("Database not available");
  return db;
}

function getDbOrNull() {
  return db;
}

// #5: LIKEワイルドカードエスケープ関数
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// ========== User Queries ==========
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = getDbOrNull();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDbOrNull();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = getDbOrNull();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Series Queries ==========
export async function getAllSeries() {
  return requireDb().select().from(series).orderBy(desc(series.createdAt));
}

export async function getSeriesById(id: number) {
  const result = await requireDb().select().from(series).where(eq(series.id, id)).limit(1);
  return result[0];
}

export async function getSeriesBySlug(slug: string) {
  const result = await requireDb().select().from(series).where(eq(series.slug, slug)).limit(1);
  return result[0];
}

export async function createSeries(data: InsertSeries) {
  const result = await requireDb().insert(series).values(data);
  return { id: result[0].insertId };
}

export async function updateSeries(id: number, data: Partial<InsertSeries>) {
  await requireDb().update(series).set(data).where(eq(series.id, id));
}

// #11: シリーズ削除時に関連記事のseriesIdをnull化
export async function deleteSeries(id: number) {
  const db = requireDb();
  // シリーズに属する記事のseriesIdをnullに
  await db.update(articles).set({ seriesId: null }).where(eq(articles.seriesId, id));
  await db.delete(series).where(eq(series.id, id));
}

// ========== Tag Queries ==========
export async function getAllTags() {
  return requireDb().select().from(tags).orderBy(asc(tags.name));
}

export async function getTagById(id: number) {
  const result = await requireDb().select().from(tags).where(eq(tags.id, id)).limit(1);
  return result[0];
}

export async function getTagBySlug(slug: string) {
  const result = await requireDb().select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return result[0];
}

export async function createTag(data: InsertTag) {
  const result = await requireDb().insert(tags).values(data);
  return { id: result[0].insertId };
}

export async function updateTag(id: number, data: Partial<InsertTag>) {
  await requireDb().update(tags).set(data).where(eq(tags.id, id));
}

export async function deleteTag(id: number) {
  const db = requireDb();
  await db.delete(articleTags).where(eq(articleTags.tagId, id));
  await db.delete(tags).where(eq(tags.id, id));
}

// ========== Article Queries ==========
export async function getArticles(options: {
  status?: "draft" | "published" | "archived";
  tagId?: number;
  seriesId?: number;
  year?: number;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "newest" | "oldest" | "weight";
}) {
  const db = getDbOrNull();
  if (!db) return { articles: [], total: 0 };

  const conditions = [];
  
  if (options.status) {
    conditions.push(eq(articles.status, options.status));
  }
  
  if (options.seriesId) {
    conditions.push(eq(articles.seriesId, options.seriesId));
  }
  
  if (options.year) {
    conditions.push(sql`YEAR(${articles.publishedAt}) = ${options.year}`);
  }
  
  // #5: LIKEエスケープを適用
  if (options.search) {
    const searchTerm = `%${escapeLikePattern(options.search)}%`;
    conditions.push(
      or(
        like(articles.title, searchTerm),
        like(articles.content, searchTerm),
        like(articles.excerpt, searchTerm)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // タグフィルタがある場合は別処理
  let articleIds: number[] | undefined;
  if (options.tagId) {
    const taggedArticles = await db
      .select({ articleId: articleTags.articleId })
      .from(articleTags)
      .where(eq(articleTags.tagId, options.tagId));
    articleIds = taggedArticles.map(a => a.articleId);
    if (articleIds.length === 0) {
      return { articles: [], total: 0 };
    }
  }

  let query = db.select().from(articles);
  
  if (whereClause && articleIds) {
    query = query.where(and(whereClause, inArray(articles.id, articleIds))) as typeof query;
  } else if (whereClause) {
    query = query.where(whereClause) as typeof query;
  } else if (articleIds) {
    query = query.where(inArray(articles.id, articleIds)) as typeof query;
  }

  // Order
  if (options.orderBy === "oldest") {
    query = query.orderBy(asc(articles.publishedAt)) as typeof query;
  } else if (options.orderBy === "weight") {
    query = query.orderBy(desc(articles.weight), desc(articles.publishedAt)) as typeof query;
  } else {
    query = query.orderBy(desc(articles.publishedAt)) as typeof query;
  }

  // Pagination
  if (options.limit) {
    query = query.limit(options.limit) as typeof query;
  }
  if (options.offset) {
    query = query.offset(options.offset) as typeof query;
  }

  const result = await query;

  // Count total
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(articles);
  if (whereClause && articleIds) {
    countQuery = countQuery.where(and(whereClause, inArray(articles.id, articleIds))) as typeof countQuery;
  } else if (whereClause) {
    countQuery = countQuery.where(whereClause) as typeof countQuery;
  } else if (articleIds) {
    countQuery = countQuery.where(inArray(articles.id, articleIds)) as typeof countQuery;
  }
  const countResult = await countQuery;
  const total = countResult[0]?.count ?? 0;

  return { articles: result, total };
}

export async function getFeaturedArticles(limit: number = 5) {
  return requireDb()
    .select()
    .from(articles)
    .where(and(eq(articles.status, "published"), sql`${articles.weight} > 0`))
    .orderBy(desc(articles.weight), desc(articles.publishedAt))
    .limit(limit);
}

export async function getArticleById(id: number) {
  const db = getDbOrNull();
  if (!db) return undefined;
  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result[0];
}

export async function getArticleBySlug(slug: string) {
  const db = getDbOrNull();
  if (!db) return undefined;
  const result = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return result[0];
}

export async function createArticle(data: InsertArticle) {
  const result = await requireDb().insert(articles).values(data);
  return { id: result[0].insertId };
}

export async function updateArticle(id: number, data: Partial<InsertArticle>) {
  await requireDb().update(articles).set(data).where(eq(articles.id, id));
}

export async function deleteArticle(id: number) {
  const db = requireDb();
  await db.delete(articleTags).where(eq(articleTags.articleId, id));
  await db.delete(comments).where(eq(comments.articleId, id));
  await db.delete(articles).where(eq(articles.id, id));
}

export async function incrementViewCount(id: number) {
  const db = getDbOrNull();
  if (!db) return;
  await db.update(articles).set({ viewCount: sql`${articles.viewCount} + 1` }).where(eq(articles.id, id));
}

// ========== Article Tags Queries ==========
export async function getArticleTags(articleId: number) {
  const db = getDbOrNull();
  if (!db) return [];
  const result = await db
    .select({ tag: tags })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, articleId));
  return result.map(r => r.tag);
}

export async function setArticleTags(articleId: number, tagIds: number[]) {
  const db = requireDb();
  
  // 既存のタグを削除
  await db.delete(articleTags).where(eq(articleTags.articleId, articleId));
  
  // 新しいタグを追加
  if (tagIds.length > 0) {
    await db.insert(articleTags).values(
      tagIds.map(tagId => ({ articleId, tagId }))
    );
  }
}

// ========== Comment Queries ==========
export async function getCommentsByArticle(articleId: number, includeAll: boolean = false) {
  const db = getDbOrNull();
  if (!db) return [];
  
  const condition = includeAll 
    ? eq(comments.articleId, articleId)
    : and(eq(comments.articleId, articleId), eq(comments.status, "approved"));
  
  return db
    .select()
    .from(comments)
    .where(condition)
    .orderBy(asc(comments.createdAt));
}

// #6: N+1クエリ問題を解決 - JOINで一括取得
export async function getCommentsByArticleWithAuthor(articleId: number, includeAll: boolean = false) {
  const db = getDbOrNull();
  if (!db) return [];

  const condition = includeAll
    ? eq(comments.articleId, articleId)
    : and(eq(comments.articleId, articleId), eq(comments.status, "approved"));

  const result = await db
    .select({
      id: comments.id,
      articleId: comments.articleId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        name: users.name,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(condition)
    .orderBy(asc(comments.createdAt));

  return result;
}

// #6: N+1クエリ問題を解決 - ペンディングコメントも一括取得
export async function getPendingCommentsWithDetails() {
  const db = getDbOrNull();
  if (!db) return [];

  const result = await db
    .select({
      id: comments.id,
      articleId: comments.articleId,
      authorId: comments.authorId,
      parentId: comments.parentId,
      content: comments.content,
      status: comments.status,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      author: {
        id: users.id,
        name: users.name,
      },
      article: {
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .leftJoin(articles, eq(comments.articleId, articles.id))
    .where(eq(comments.status, "pending"))
    .orderBy(desc(comments.createdAt));

  return result;
}

export async function getCommentById(id: number) {
  const db = getDbOrNull();
  if (!db) return undefined;
  const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return result[0];
}

export async function createComment(data: InsertComment) {
  const result = await requireDb().insert(comments).values(data);
  return { id: result[0].insertId };
}

export async function updateCommentStatus(id: number, status: "pending" | "approved" | "rejected") {
  await requireDb().update(comments).set({ status }).where(eq(comments.id, id));
}

// #10: コメント再帰削除 - 全子孫コメントを削除
export async function deleteComment(id: number) {
  const db = requireDb();
  
  // 子コメントを再帰的に取得して削除
  const children = await db
    .select({ id: comments.id })
    .from(comments)
    .where(eq(comments.parentId, id));

  for (const child of children) {
    await deleteComment(child.id);
  }

  await db.delete(comments).where(eq(comments.id, id));
}

export async function getPendingComments() {
  const db = getDbOrNull();
  if (!db) return [];
  return db
    .select()
    .from(comments)
    .where(eq(comments.status, "pending"))
    .orderBy(desc(comments.createdAt));
}

// ========== Archive Queries ==========
// #16: 型キャストの改善
export async function getArchiveYears() {
  const db = getDbOrNull();
  if (!db) return [];
  
  // Use raw SQL to avoid GROUP BY issues with MySQL's only_full_group_by mode
  const result = await db.execute<{ year: number; count: number }[]>(
    sql`SELECT YEAR(publishedAt) as year, COUNT(*) as count FROM articles WHERE status = 'published' AND publishedAt IS NOT NULL GROUP BY YEAR(publishedAt) ORDER BY year DESC`
  );
  
  // Result is in result[0] for mysql2
  const rows = (result as unknown as [{ year: number; count: number }[]])[0];
  return rows.filter(r => r.year !== null);
}

export async function getTagsWithCount() {
  const db = getDbOrNull();
  if (!db) return [];
  const result = await db
    .select({ 
      tag: tags, 
      count: sql<number>`count(${articleTags.articleId})` 
    })
    .from(tags)
    .leftJoin(articleTags, eq(tags.id, articleTags.tagId))
    .leftJoin(articles, and(eq(articleTags.articleId, articles.id), eq(articles.status, "published")))
    .groupBy(tags.id)
    .orderBy(desc(sql`count(${articleTags.articleId})`));
  return result;
}

export async function getSeriesWithCount() {
  const db = getDbOrNull();
  if (!db) return [];
  const result = await db
    .select({ 
      series: series, 
      count: sql<number>`count(${articles.id})` 
    })
    .from(series)
    .leftJoin(articles, and(eq(series.id, articles.seriesId), eq(articles.status, "published")))
    .groupBy(series.id)
    .orderBy(desc(sql`count(${articles.id})`));
  return result;
}
