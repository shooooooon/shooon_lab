import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Search as SearchIcon, Calendar, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useState, useEffect } from "react";

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

// Article Card
function SearchResultCard({ article }: { article: any }) {
  return (
    <Link href={`/article/${article.slug}`}>
      <Card className="article-card hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <h3 className="font-serif font-semibold text-lg mb-2 hover:text-primary transition-colors">
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
      </Card>
    </Link>
  );
}

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
                <SearchResultCard key={article.id} article={article} />
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
