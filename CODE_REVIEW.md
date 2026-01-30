# SHooon Lab コードレビュー改善指示書

> **レビュー日:** 2026-01-30
> **対象:** Manus生成コード全体
> **レビュアー:** Claude Code

---

## 概要

React + Express + tRPC + Drizzle ORM によるフルスタックブログプラットフォームのコードレビュー結果です。
tRPCによる型安全なAPI設計やshadcn/uiの活用など基本設計は良好ですが、セキュリティ・データ整合性・パフォーマンスに改善すべき点があります。

以下、重大度順に改善項目を記載します。

---

## 重大度: 高

### 1. 未公開記事が公開APIから閲覧可能

**ファイル:** `server/routers.ts` L174-206

**問題:**
`getById` と `getBySlug` は `publicProcedure` だが、記事のステータスチェックがない。
draft や archived の記事のスラッグやIDを知っていれば、誰でも未公開記事の全文を閲覧できる。

**現状のコード:**
```typescript
getBySlug: publicProcedure
  .input(z.object({ slug: z.string(), incrementView: z.boolean().default(false) }))
  .query(async ({ input }) => {
    const article = await db.getArticleBySlug(input.slug);
    if (!article) return null;
    // ← ステータスチェックなし
```

**改善方法:**
- 公開APIでは `status === "published"` の記事のみ返す
- 管理者向けには別途 `getByIdAdmin` / `getBySlugAdmin` を `adminProcedure` で用意する
- または `ctx.user?.role === "admin"` でステータスフィルタを切り替える

```typescript
getBySlug: publicProcedure
  .input(z.object({ slug: z.string(), incrementView: z.boolean().default(false) }))
  .query(async ({ ctx, input }) => {
    const article = await db.getArticleBySlug(input.slug);
    if (!article) return null;

    // 管理者以外は公開記事のみ閲覧可能
    if (article.status !== "published" && ctx.user?.role !== "admin") {
      return null;
    }
    // ...
  }),
```

---

### 2. queryプロシージャ内での副作用（ビューカウント）

**ファイル:** `server/routers.ts` L189-197

**問題:**
tRPCの `query`（HTTP GETに相当）でDBへの書き込み（ビューカウントのインクリメント）を実行している。
`query` はキャッシュ・プリフェッチ・リトライの対象になりうるため、以下のリスクがある:

- ボット・クローラによる意図しないカウント増加
- ブラウザのプリフェッチや React Query のリトライによる重複カウント
- RESTful設計原則（GETは冪等であるべき）への違反

**改善方法:**
ビューカウントのインクリメントを別の `mutation` に分離する。

```typescript
incrementView: publicProcedure
  .input(z.object({ slug: z.string() }))
  .mutation(async ({ input }) => {
    const article = await db.getArticleBySlug(input.slug);
    if (article && article.status === "published") {
      await db.incrementViewCount(article.id);
    }
    return { success: true };
  }),
```

クライアント側で記事ページ表示時にこの mutation を呼び出す。
可能であればレート制限（IPベースまたはセッションベース）を追加し、同一ユーザーの連続インクリメントを防ぐ。

---

### 3. `(data as any).publishedAt` — 型安全性の回避

**ファイル:** `server/routers.ts` L263

**問題:**
`as any` による型キャストで TypeScript の型チェックが無効化されている。
tRPC + Drizzle で構築した型安全なパイプラインの意味が損なわれる。

**現状のコード:**
```typescript
if (article && data.status === "published" && article.status !== "published") {
  (data as any).publishedAt = new Date();
}
```

**改善方法:**
```typescript
const updateData = {
  ...data,
  ...(data.status === "published" && article?.status !== "published"
    ? { publishedAt: new Date() }
    : {}),
};
await db.updateArticle(id, updateData);
```

---

### 4. コメント返信フォームの表示バグ

**ファイル:** `client/src/components/CommentSection.tsx` L251-266

**問題:**
返信フォームの表示判定が `replyingTo === comment.id` でルートコメントのIDとのみ比較される。
子コメントの返信ボタンを押した場合、`replyingTo` には子コメントのIDが入るが、
表示はルートコメントのループ内でのみチェックされるため、子コメントへの返信フォームが表示されない。

**現状のコード:**
```tsx
{commentTree.map((comment) => (
  <div key={comment.id}>
    <CommentThread
      comment={comment}
      onReply={(parentId) => setReplyingTo(parentId)}
    />
    {replyingTo === comment.id && (  // ← ルートコメントのIDのみチェック
      <div className="ml-13 mb-4">
        <CommentForm ... parentId={comment.id} />
      </div>
    )}
  </div>
))}
```

**改善方法:**
返信フォームの表示を `CommentThread` コンポーネント内に移動し、各コメントの直下に表示されるようにする。

```tsx
function CommentThread({ comment, replyingTo, onReply, onCancelReply, onReplySuccess, articleId, depth = 0 }) {
  return (
    <>
      <CommentItem comment={comment} onReply={onReply} depth={depth} />
      {replyingTo === comment.id && (
        <div style={{ marginLeft: `${(depth + 1) * 2}rem` }}>
          <CommentForm
            articleId={articleId}
            parentId={comment.id}
            onCancel={onCancelReply}
            onSuccess={onReplySuccess}
          />
        </div>
      )}
      {comment.replies.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          replyingTo={replyingTo}
          onReply={onReply}
          onCancelReply={onCancelReply}
          onReplySuccess={onReplySuccess}
          articleId={articleId}
          depth={depth + 1}
        />
      ))}
    </>
  );
}
```

---

### 5. 検索入力のLIKEワイルドカードエスケープ漏れ

**ファイル:** `server/db.ts` L215-224

**問題:**
ユーザー入力をそのまま `%${options.search}%` としてLIKEパターンに組み込んでいる。
Drizzle ORMのパラメータ化により直接のSQLインジェクションではないが、
ユーザーが `%` や `_` を入力すると意図しないワイルドカードマッチが発生する。

**改善方法:**
```typescript
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

if (options.search) {
  const searchTerm = `%${escapeLikePattern(options.search)}%`;
  // ...
}
```

---

## 重大度: 中

### 6. N+1クエリ問題 — コメント作成者情報の取得

**ファイル:** `server/routers.ts` L291-298, L306-311, L319-327

**問題:**
コメント一覧取得時に、各コメントごとに `db.getUserById()` を個別に呼び出している。
3箇所（`listByArticle`, `listByArticleAdmin`, `listPending`）で同じパターンが繰り返されている。
コメントが100件あればDBクエリが101回実行される。

**現状のコード:**
```typescript
const commentsWithAuthor = await Promise.all(
  commentsList.map(async (comment) => {
    const author = await db.getUserById(comment.authorId);
    return { ...comment, author };
  })
);
```

**改善方法:**
JOINクエリで一括取得する。

```typescript
// db.ts に追加
export async function getCommentsByArticleWithAuthor(articleId: number, includeAll: boolean) {
  const db = await getDb();
  if (!db) return [];

  const condition = includeAll
    ? eq(comments.articleId, articleId)
    : and(eq(comments.articleId, articleId), eq(comments.status, "approved"));

  return db
    .select({
      comment: comments,
      author: { id: users.id, name: users.name },
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(condition)
    .orderBy(asc(comments.createdAt));
}
```

---

### 7. `adminProcedure` の重複定義

**ファイル:** `server/routers.ts` L10-15 / `server/_core/trpc.ts` L30-45

**問題:**
`trpc.ts` で `adminProcedure` がexportされているにもかかわらず、`routers.ts` では独自に `protectedProcedure.use(...)` で定義している。
2箇所で管理者チェックロジックが存在し、メッセージも異なる（`"Admin access required"` vs `NOT_ADMIN_ERR_MSG`）。

**改善方法:**
`routers.ts` の独自定義を削除し、`trpc.ts` からimportした `adminProcedure` を使用する。

```typescript
// routers.ts
import { publicProcedure, protectedProcedure, adminProcedure, router } from "./_core/trpc";
// ↑ adminProcedure を追加

// L10-15 の独自定義を削除
```

---

### 8. `article_tags` テーブルにユニーク制約がない

**ファイル:** `drizzle/schema.ts` L81-85

**問題:**
`(articleId, tagId)` の複合ユニーク制約がないため、同じ記事に同じタグが重複して紐づく可能性がある。

**改善方法:**
```typescript
import { uniqueIndex } from "drizzle-orm/mysql-core";

export const articleTags = mysqlTable("article_tags", {
  id: int("id").autoincrement().primaryKey(),
  articleId: int("articleId").notNull(),
  tagId: int("tagId").notNull(),
}, (table) => [
  uniqueIndex("article_tag_unique").on(table.articleId, table.tagId),
]);
```

---

### 9. 外部キー制約が未定義

**ファイル:** `drizzle/schema.ts` 全体, `drizzle/relations.ts`（空ファイル）

**問題:**
以下のカラムに外部キー制約が定義されていない:
- `articles.authorId` → `users.id`
- `articles.seriesId` → `series.id`
- `comments.articleId` → `articles.id`
- `comments.authorId` → `users.id`
- `comments.parentId` → `comments.id`
- `articleTags.articleId` → `articles.id`
- `articleTags.tagId` → `tags.id`

参照整合性がDB層で保証されず、孤立レコードが発生しうる。

**改善方法:**
Drizzleの `references()` を使用して外部キーを定義する。

```typescript
authorId: int("authorId").notNull().references(() => users.id),
seriesId: int("seriesId").references(() => series.id, { onDelete: "set null" }),
// etc.
```

また `drizzle/relations.ts` にDrizzleのリレーション定義を追加する。

---

### 10. `deleteComment` で孫コメント以降が残る

**ファイル:** `server/db.ts` L400-406

**問題:**
直接の子コメントのみ削除され、孫コメント以降は親参照が壊れた状態で残る。

**現状のコード:**
```typescript
export async function deleteComment(id: number) {
  await db.delete(comments).where(eq(comments.parentId, id));
  await db.delete(comments).where(eq(comments.id, id));
}
```

**改善方法:**
再帰的に全子孫コメントを削除する。

```typescript
export async function deleteComment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

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
```

または外部キー制約で `ON DELETE CASCADE` を使用する（改善項目 #9 参照）。

---

### 11. `deleteSeries` で関連記事の `seriesId` が null 化されない

**ファイル:** `server/db.ts` L140-144

**問題:**
シリーズ削除時に、そのシリーズに属する記事の `seriesId` を `null` に更新していない。
削除後、記事が存在しないシリーズIDを参照し続ける。

**改善方法:**
```typescript
export async function deleteSeries(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // シリーズに属する記事のseriesIdをnullに
  await db.update(articles).set({ seriesId: null }).where(eq(articles.seriesId, id));
  await db.delete(series).where(eq(series.id, id));
}
```

または外部キー制約で `ON DELETE SET NULL` を使用する。

---

### 12. `getDb()` の遅延初期化に競合リスクと冗長パターン

**ファイル:** `server/db.ts` L13-25

**問題:**
- 複数の同時リクエストで `getDb()` が呼ばれた場合、初期化が重複する可能性がある
- すべてのDB関数で `const db = await getDb(); if (!db) ...` を毎回繰り返しており冗長

**改善方法:**
サーバー起動時に一度だけ初期化し、モジュールレベルでexportする。

```typescript
// db.ts
const db = process.env.DATABASE_URL ? drizzle(process.env.DATABASE_URL) : null;

function requireDb() {
  if (!db) throw new Error("Database not available");
  return db;
}

// 各関数で使用
export async function getAllSeries() {
  return requireDb().select().from(series).orderBy(desc(series.createdAt));
}
```

---

## 重大度: 低

### 13. `ArticleCard` コンポーネントが3箇所で重複実装（`any`型）

**ファイル:**
- `client/src/pages/Home.tsx` L130
- `client/src/pages/Archive.tsx` L25（同様のパターンが存在する想定）
- `client/src/pages/Search.tsx` L28（同様のパターンが存在する想定）

**問題:**
- 各ページで `ArticleCard` が独自に定義されている（DRY原則違反）
- `article` パラメータが `any` 型で、tRPCの型推論の恩恵を受けられていない

**改善方法:**
共通コンポーネントとして `client/src/components/ArticleCard.tsx` に抽出し、
tRPCの推論型または明示的な型を使用する。

```typescript
// client/src/components/ArticleCard.tsx
import type { AppRouter } from "@server/routers";
import type { inferRouterOutputs } from "@trpc/server";

type ArticleListOutput = inferRouterOutputs<AppRouter>["articles"]["list"];
type ArticleItem = ArticleListOutput["articles"][number];

export function ArticleCard({ article }: { article: ArticleItem }) {
  // ...
}
```

---

### 14. `AdminSidebar` が `ArticleEditor.tsx` に直接定義されている

**ファイル:** `client/src/pages/admin/ArticleEditor.tsx` L26-59

**問題:**
`DashboardLayout.tsx` が存在するにもかかわらず、`ArticleEditor.tsx` 内にサイドバーが独自に定義されている。
他の管理ページ（`Dashboard.tsx`, `Articles.tsx` 等）と統一されていない可能性がある。

**改善方法:**
`DashboardLayout` を使用するか、`AdminSidebar` を共通コンポーネントとして切り出す。

---

### 15. `generateSlug` が日本語タイトルに対応していない

**ファイル:** `client/src/pages/admin/ArticleEditor.tsx` L62-69

**問題:**
```typescript
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")  // ← 日本語文字がすべて除去される
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}
```

日本語タイトル（例: "Reactの基礎"）の場合、空文字列またはほぼ空のスラッグが生成される。

**改善方法:**
- 日本語の場合はローマ字変換ライブラリ（`kuroshiro` 等）を使用する
- または、タイムスタンプやランダム文字列をフォールバックとして使う
- 最低限、スラッグが空の場合に `nanoid` 等で自動生成する

```typescript
import { nanoid } from "nanoid";

function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  return slug || nanoid(10);
}
```

---

### 16. `getArchiveYears` の型キャスト

**ファイル:** `server/db.ts` L424-431

**問題:**
```typescript
const rows = (result as any)[0] as { year: number; count: number }[];
```

`as any` によるキャストは mysql2 ドライバの戻り値型との不一致が原因。
実行時にスキーマが変わった場合にエラーが検出できない。

**改善方法:**
Drizzleの型安全なクエリビルダーを使用してリファクタリングする。

```typescript
export async function getArchiveYears() {
  const db = requireDb();
  const result = await db
    .select({
      year: sql<number>`YEAR(${articles.publishedAt})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(articles)
    .where(
      and(
        eq(articles.status, "published"),
        sql`${articles.publishedAt} IS NOT NULL`
      )
    )
    .groupBy(sql`YEAR(${articles.publishedAt})`)
    .orderBy(desc(sql`YEAR(${articles.publishedAt})`));

  return result.filter(r => r.year !== null);
}
```

---

### 17. `list` APIの `status` パラメータが公開APIで受け付けられる

**ファイル:** `server/routers.ts` L139-156

**問題:**
公開API `articles.list` に `status` パラメータがあり、デフォルトは `"published"` だが、
リクエストで `status: "draft"` を指定すれば下書き記事の一覧が取得できる。

**改善方法:**
公開APIでは `status` パラメータを受け付けず、常に `"published"` を使用する。

```typescript
list: publicProcedure
  .input(z.object({
    // status は受け付けない
    tagId: z.number().optional(),
    seriesId: z.number().optional(),
    // ...
  }).optional())
  .query(async ({ input }) => {
    const options = {
      ...input,
      status: "published" as const,  // 常に公開記事のみ
    };
    return db.getArticles(options);
  }),
```

---

### 18. `App.tsx` のルーティングでレイアウトの適用が統一されていない

**ファイル:** `client/src/App.tsx`, 各ページコンポーネント

**問題:**
各公開ページ（Home, Article, Archive等）がそれぞれ `<Layout>` をラップしており、
admin ページは独自のレイアウトを使っている。`App.tsx` のルーターレベルでの統一的なレイアウト適用がない。

**改善方法:**
ルーターレベルで公開ページ用のレイアウトを適用する。

```tsx
// App.tsx
function PublicLayout({ children }: { children: React.ReactNode }) {
  return <Layout>{children}</Layout>;
}

// ルーティングで適用
<Route path="/">
  <PublicLayout><Home /></PublicLayout>
</Route>
```

各ページコンポーネントから `<Layout>` のインポートと使用を削除する。

---

## 改善優先度まとめ

| 優先度 | # | 項目 | 影響 |
|--------|---|------|------|
| **最優先** | 1 | 未公開記事のアクセス制御 | セキュリティ |
| **最優先** | 17 | list APIのstatus公開 | セキュリティ |
| **高** | 2 | queryでの副作用 | 設計原則・データ正確性 |
| **高** | 4 | コメント返信フォームバグ | ユーザー体験 |
| **高** | 6 | N+1クエリ | パフォーマンス |
| **中** | 3 | as anyの型キャスト | 型安全性 |
| **中** | 5 | LIKEエスケープ | データ正確性 |
| **中** | 8 | ユニーク制約 | データ整合性 |
| **中** | 9 | 外部キー制約 | データ整合性 |
| **中** | 10 | コメント再帰削除 | データ整合性 |
| **中** | 11 | シリーズ削除時のnull化 | データ整合性 |
| **中** | 12 | DB初期化パターン | コード品質 |
| **低** | 7 | adminProcedure重複 | 保守性 |
| **低** | 13 | ArticleCard重複・any型 | コード品質 |
| **低** | 14 | AdminSidebar配置 | コード品質 |
| **低** | 15 | 日本語スラッグ | 機能性 |
| **低** | 16 | 型キャスト | 型安全性 |
| **低** | 18 | レイアウト統一 | 保守性 |
