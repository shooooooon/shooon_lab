import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { Search as SearchIcon, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { ArticleCardHorizontal } from "@/components/ArticleCard";

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// #B: ローカルのSearchResultCard定義を削除し、共通コンポーネントを使用

export default function Search() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isFetching } = trpc.articles.list.useQuery(
    {
      search: debouncedQuery,
      limit: 20,
    },
    {
      enabled: debouncedQuery.length >= 2,
    }
  );

  return (
    <Layout>
      <div className="container max-w-3xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">記事を検索</h1>
          <p className="text-muted-foreground">
            タイトルや本文からキーワードで記事を検索できます
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="検索キーワードを入力..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-12 text-lg"
            autoFocus
          />
          {isFetching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Search Results */}
        {debouncedQuery.length < 2 ? (
          <div className="text-center py-12 text-muted-foreground">
            <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>2文字以上入力してください</p>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="mt-4 text-muted-foreground">検索中...</p>
          </div>
        ) : data?.articles && data.articles.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              「{debouncedQuery}」の検索結果: {data.total}件
            </p>
            <div className="space-y-4">
              {data.articles.map((article) => (
                <ArticleCardHorizontal key={article.id} article={article} />
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <SearchIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>「{debouncedQuery}」に一致する記事が見つかりませんでした</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
