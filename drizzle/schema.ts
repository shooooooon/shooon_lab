import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, uniqueIndex } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
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

/**
 * Series - 記事シリーズ（連載）
 */
export const series = mysqlTable("series", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  coverImage: text("coverImage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Series = typeof series.$inferSelect;
export type InsertSeries = typeof series.$inferInsert;

/**
 * Tags - 記事タグ
 */
export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 128 }).notNull(),
  color: varchar("color", { length: 32 }).default("#6b7280"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type InsertTag = typeof tags.$inferInsert;

/**
 * Articles - ブログ記事
 * #9: 外部キー制約を追加
 */
export const articles = mysqlTable("articles", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 256 }).notNull().unique(),
  title: varchar("title", { length: 512 }).notNull(),
  excerpt: text("excerpt"),
  content: text("content").notNull(),
  coverImage: text("coverImage"),
  // #9: 外部キー制約 - usersテーブルへの参照
  authorId: int("authorId").notNull().references(() => users.id),
  // #9: 外部キー制約 - seriesテーブルへの参照（削除時はnull化）
  seriesId: int("seriesId").references(() => series.id, { onDelete: "set null" }),
  seriesOrder: int("seriesOrder"),
  weight: int("weight").default(0).notNull(), // 特集記事の重み（高いほど優先）
  status: mysqlEnum("status", ["draft", "published", "archived"]).default("draft").notNull(),
  publishedAt: timestamp("publishedAt"),
  // リッチメディア: ギャラリー画像、脚注、引用などをJSONで保存
  gallery: json("gallery").$type<string[]>(),
  footnotes: json("footnotes").$type<{ id: string; content: string }[]>(),
  viewCount: int("viewCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = typeof articles.$inferInsert;

/**
 * ArticleTags - 記事とタグの中間テーブル
 * #8: ユニーク制約を追加
 * #9: 外部キー制約を追加
 */
export const articleTags = mysqlTable("article_tags", {
  id: int("id").autoincrement().primaryKey(),
  // #9: 外部キー制約 - articlesテーブルへの参照（削除時はカスケード削除）
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  // #9: 外部キー制約 - tagsテーブルへの参照（削除時はカスケード削除）
  tagId: int("tagId").notNull().references(() => tags.id, { onDelete: "cascade" }),
}, (table) => [
  // #8: ユニーク制約 - 同じ記事に同じタグが重複しないように
  uniqueIndex("article_tag_unique").on(table.articleId, table.tagId),
]);

export type ArticleTag = typeof articleTags.$inferSelect;
export type InsertArticleTag = typeof articleTags.$inferInsert;

/**
 * Comments - コメント（スレッド対応）
 * #9: 外部キー制約を追加
 */
export const comments = mysqlTable("comments", {
  id: int("id").autoincrement().primaryKey(),
  // #9: 外部キー制約 - articlesテーブルへの参照（削除時はカスケード削除）
  articleId: int("articleId").notNull().references(() => articles.id, { onDelete: "cascade" }),
  // #9: 外部キー制約 - usersテーブルへの参照
  authorId: int("authorId").notNull().references(() => users.id),
  // 親コメントID（返信の場合）- 自己参照外部キーはDrizzleでは直接サポートされないため、アプリケーション層で管理
  parentId: int("parentId"),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type InsertComment = typeof comments.$inferInsert;
