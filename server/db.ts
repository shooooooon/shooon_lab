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

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ========== User Queries ==========
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
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
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ========== Series Queries ==========
export async function getAllSeries() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(series).orderBy(desc(series.createdAt));
}

export async function getSeriesById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(series).where(eq(series.id, id)).limit(1);
  return result[0];
}

export async function getSeriesBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(series).where(eq(series.slug, slug)).limit(1);
  return result[0];
}

export async function createSeries(data: InsertSeries) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(series).values(data);
  return { id: result[0].insertId };
}

export async function updateSeries(id: number, data: Partial<InsertSeries>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(series).set(data).where(eq(series.id, id));
}

export async function deleteSeries(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(series).where(eq(series.id, id));
}

// ========== Tag Queries ==========
export async function getAllTags() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tags).orderBy(asc(tags.name));
}

export async function getTagById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  return result[0];
}

export async function getTagBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(eq(tags.slug, slug)).limit(1);
  return result[0];
}

export async function createTag(data: InsertTag) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tags).values(data);
  return { id: result[0].insertId };
}

export async function updateTag(id: number, data: Partial<InsertTag>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tags).set(data).where(eq(tags.id, id));
}

export async function deleteTag(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
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
  const db = await getDb();
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
  
  if (options.search) {
    const searchTerm = `%${options.search}%`;
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
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(articles)
    .where(and(eq(articles.status, "published"), sql`${articles.weight} > 0`))
    .orderBy(desc(articles.weight), desc(articles.publishedAt))
    .limit(limit);
}

export async function getArticleById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result[0];
}

export async function getArticleBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(articles).where(eq(articles.slug, slug)).limit(1);
  return result[0];
}

export async function createArticle(data: InsertArticle) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(articles).values(data);
  return { id: result[0].insertId };
}

export async function updateArticle(id: number, data: Partial<InsertArticle>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(articles).set(data).where(eq(articles.id, id));
}

export async function deleteArticle(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(articleTags).where(eq(articleTags.articleId, id));
  await db.delete(comments).where(eq(comments.articleId, id));
  await db.delete(articles).where(eq(articles.id, id));
}

export async function incrementViewCount(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(articles).set({ viewCount: sql`${articles.viewCount} + 1` }).where(eq(articles.id, id));
}

// ========== Article Tags Queries ==========
export async function getArticleTags(articleId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db
    .select({ tag: tags })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, articleId));
  return result.map(r => r.tag);
}

export async function setArticleTags(articleId: number, tagIds: number[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
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
  const db = await getDb();
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

export async function getCommentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return result[0];
}

export async function createComment(data: InsertComment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(comments).values(data);
  return { id: result[0].insertId };
}

export async function updateCommentStatus(id: number, status: "pending" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(comments).set({ status }).where(eq(comments.id, id));
}

export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 子コメントも削除
  await db.delete(comments).where(eq(comments.parentId, id));
  await db.delete(comments).where(eq(comments.id, id));
}

export async function getPendingComments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(comments)
    .where(eq(comments.status, "pending"))
    .orderBy(desc(comments.createdAt));
}

// ========== Archive Queries ==========
export async function getArchiveYears() {
  const db = await getDb();
  if (!db) return [];
  
  // Use raw SQL to avoid GROUP BY issues with MySQL's only_full_group_by mode
  const result = await db.execute<{ year: number; count: number }[]>(
    sql`SELECT YEAR(publishedAt) as year, COUNT(*) as count FROM articles WHERE status = 'published' AND publishedAt IS NOT NULL GROUP BY YEAR(publishedAt) ORDER BY year DESC`
  );
  
  // Result is in result[0] for mysql2
  const rows = (result as any)[0] as { year: number; count: number }[];
  return rows.filter(r => r.year !== null);
}

export async function getTagsWithCount() {
  const db = await getDb();
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
  const db = await getDb();
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
