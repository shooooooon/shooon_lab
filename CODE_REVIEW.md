# SHooon Lab コードレビュー改善指示書（第2版）

> **レビュー日:** 2026-01-30
> **対象:** 第1版改善コミット (`95bfd8f`) の検証結果
> **レビュアー:** Claude Code

---

## 概要

第1版で指摘した18件のうち15件が対応済みです。
本文書では、対応が不完全だった項目と、改善の過程で新たに発生した問題を記載します。

---

## 第1版の対応状況サマリー

| # | 項目 | 判定 |
|---|------|------|
| 1 | 未公開記事のアクセス制御 | **対応済み** |
| 2 | queryでの副作用（ビューカウント） | **対応済み** ※新規問題あり（後述 #A） |
| 3 | `as any`型キャスト（routers.ts） | **対応済み** |
| 4 | コメント返信フォームバグ | **対応済み** |
| 5 | LIKEエスケープ | **対応済み** |
| 6 | N+1クエリ | **対応済み** |
| 7 | adminProcedure重複 | **対応済み** |
| 8 | ユニーク制約 | **対応済み** |
| 9 | 外部キー制約 | **対応済み** |
| 10 | コメント再帰削除 | **対応済み** |
| 11 | シリーズ削除時のnull化 | **対応済み** |
| 12 | DB初期化パターン | **対応済み** |
| 13 | ArticleCard共通化 | **不完全**（後述 #B） |
| 14 | AdminSidebar配置 | 未対応（低優先度） |
| 15 | 日本語スラッグ | **対応済み** |
| 16 | getArchiveYears型キャスト | **不完全**（後述 #C） |
| 17 | list APIのstatus公開 | **対応済み** |
| 18 | レイアウト統一 | 未対応（低優先度） |

---

## 改善が必要な項目

### A. ビューカウントの重複実行リスク（新規）

**ファイル:** `client/src/pages/Article.tsx` L155-160

**問題:**
第1版 #2 の対応として `incrementView` mutation を `useEffect` から呼び出すように変更されたが、
同一セッション内で mutation が複数回実行される可能性がある。

**現状のコード:**
```typescript
const incrementViewMutation = trpc.articles.incrementView.useMutation();
useEffect(() => {
  if (params.slug && article) {
    incrementViewMutation.mutate({ slug: params.slug });
  }
}, [params.slug, article?.id]);
```

**問題点:**
1. `article?.id` が依存配列にあるため、React Queryのバックグラウンドリフェッチで `article` オブジェクトが再取得されるたびにmutationが再実行される可能性がある
2. React 18のStrict Modeでは開発時に `useEffect` が2回実行される
3. ESLintの `react-hooks/exhaustive-deps` ルールに対して `incrementViewMutation` が依存配列に含まれていない

**改善方法:**
`useRef` で一度だけ実行するガードを追加する。

```typescript
const incrementViewMutation = trpc.articles.incrementView.useMutation();
const hasIncrementedRef = useRef(false);

useEffect(() => {
  if (params.slug && article && !hasIncrementedRef.current) {
    hasIncrementedRef.current = true;
    incrementViewMutation.mutate({ slug: params.slug });
  }
}, [params.slug, article?.id]);
```

---

### B. `Archive.tsx` と `Search.tsx` の `ArticleCard` が共通化されていない

**ファイル:**
- `client/src/pages/Archive.tsx` L25
- `client/src/pages/Search.tsx` L28

**問題:**
第1版 #13 の対応として `client/src/components/ArticleCard.tsx` が新規作成され、
`Home.tsx` は共通コンポーネントに切り替え済みだが、
`Archive.tsx` と `Search.tsx` には依然としてローカルの `ArticleCard` / `SearchResultCard` が `any` 型で残っている。

**現状のコード（Archive.tsx L25）:**
```typescript
function ArticleCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <Card className="article-card h-full overflow-hidden hover:border-primary/50 transition-colors">
        {/* ... */}
      </Card>
    </Link>
  );
}
```

**現状のコード（Search.tsx L28）:**
```typescript
function SearchResultCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <Card className="article-card hover:border-primary/50 transition-colors">
        {/* ... */}
      </Card>
    </Link>
  );
}
```

**改善方法:**

`Archive.tsx` については、レイアウトが横並び（画像+テキスト）のため、
`ArticleCard.tsx` に既に定義されている `ArticleCardCompact` を使用するか、
Archiveのレイアウトに合わせたバリエーションを `ArticleCard.tsx` に追加する。

```typescript
// client/src/components/ArticleCard.tsx に横並びバリエーションを追加
export function ArticleCardHorizontal({ article }: { article: ArticleItem }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <Card className="article-card h-full overflow-hidden hover:border-primary/50 transition-colors">
        <div className="flex flex-col sm:flex-row">
          {article.coverImage && (
            <div className="sm:w-48 aspect-video sm:aspect-square overflow-hidden flex-shrink-0">
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardContent className="p-4 flex-1">
            <h3 className="font-serif font-semibold text-lg mb-2 line-clamp-2 hover:text-primary transition-colors">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="text-muted-foreground text-sm line-clamp-2 mb-3">
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {article.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(article.publishedAt).toLocaleDateString("ja-JP")}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {article.viewCount}
              </span>
            </div>
          </CardContent>
        </div>
      </Card>
    </Link>
  );
}
```

**Archive.tsx の修正:**
```typescript
// ローカルのArticleCard定義を削除し、共通コンポーネントをimport
import { ArticleCardHorizontal } from "@/components/ArticleCard";

// 使用箇所で置換
// 旧: <ArticleCard article={article} />
// 新: <ArticleCardHorizontal article={article} />
```

**Search.tsx の修正:**
```typescript
// ローカルのSearchResultCard定義を削除し、共通コンポーネントをimport
import { ArticleCard } from "@/components/ArticleCard";

// 使用箇所で置換
// 旧: <SearchResultCard article={article} />
// 新: <ArticleCard article={article} />
```

---

### C. `getArchiveYears` の型キャスト改善が不十分

**ファイル:** `server/db.ts` L478

**問題:**
第1版 #16 の対応として `as any` を `as unknown as [...]` に変更されたが、
`unknown` 経由のキャストは `any` より安全度がわずかに上がるだけで、
実質的に型安全性は確保されていない。

**現状のコード:**
```typescript
const rows = (result as unknown as [{ year: number; count: number }[]])[0];
```

**改善方法:**
Drizzleの型安全なクエリビルダーを使用して `db.execute()` + 型キャストを排除する。

```typescript
export async function getArchiveYears() {
  const db = getDbOrNull();
  if (!db) return [];

  const result = await db
    .select({
      year: sql<number>`YEAR(${articles.publishedAt})`,
      count: sql<number>`cast(COUNT(*) as unsigned)`,
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

この方法であれば `sql<number>` のジェネリクスで戻り値の型が推論され、キャスト不要になる。

---

### D. テストのアサーション弱体化

**ファイル:** `server/blog.test.ts` 複数箇所

**問題:**
第1版 #7（adminProcedure統一）の対応に伴い、テストのエラーメッセージ検証が削除された。

**修正前:**
```typescript
await expect(
  caller.series.create({ slug: "test-series", title: "Test Series" })
).rejects.toThrow("Admin access required");
```

**修正後:**
```typescript
await expect(
  caller.series.create({ slug: "test-series", title: "Test Series" })
).rejects.toThrow();
```

`.toThrow()` は「何らかのエラーが投げられた」ことしか検証しない。
例えばバリデーションエラーや内部エラーでもテストがパスしてしまい、
「管理者権限チェックが正しく動作している」ことを保証できない。

**改善方法:**
`trpc.ts` で使用されている `NOT_ADMIN_ERR_MSG` 定数をテストでimportして検証する。

```typescript
import { NOT_ADMIN_ERR_MSG } from "@shared/const";

// 各テストで
await expect(
  caller.series.create({ slug: "test-series", title: "Test Series" })
).rejects.toThrow(NOT_ADMIN_ERR_MSG);
```

---

## 改善優先度まとめ

| 優先度 | # | 項目 | 影響 |
|--------|---|------|------|
| **高** | A | ビューカウント重複実行 | データ正確性 |
| **中** | B | Archive/Search ArticleCard共通化 | 型安全性・保守性 |
| **中** | D | テストのアサーション弱体化 | テスト品質 |
| **低** | C | getArchiveYears型キャスト | 型安全性 |

---

## 未対応（第1版から継続 — 低優先度）

| # | 項目 | 備考 |
|---|------|------|
| 14 | AdminSidebar配置 | `DashboardLayout` との統一は影響範囲が広いため将来対応で可 |
| 18 | レイアウト統一 | 各ページが `<Layout>` を個別にラップする現状でも動作上の問題はない |
