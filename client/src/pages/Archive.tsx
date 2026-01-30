import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useSearch } from "wouter";
import { Calendar, Tag, BookOpen, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { ArticleCardHorizontal } from "@/components/ArticleCard";

// Parse search params
function useQueryParams() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  return {
    tagId: params.get("tagId") ? parseInt(params.get("tagId")!) : undefined,
    seriesId: params.get("seriesId") ? parseInt(params.get("seriesId")!) : undefined,
    year: params.get("year") ? parseInt(params.get("year")!) : undefined,
    filter: params.get("filter") || "all",
  };
}

// #B: ローカルのArticleCard定義を削除し、共通コンポーネントを使用

// Filter Sidebar
function FilterSidebar({
  years,
  tags,
  series,
  activeFilters,
  onFilterChange,
}: {
  years: { year: number; count: number }[];
  tags: { tag: any; count: number }[];
  series: { series: any; count: number }[];
  activeFilters: { tagId?: number; seriesId?: number; year?: number };
  onFilterChange: (filters: { tagId?: number; seriesId?: number; year?: number }) => void;
}) {
  const clearFilters = () => {
    onFilterChange({});
  };

  const hasActiveFilters = activeFilters.tagId || activeFilters.seriesId || activeFilters.year;

  return (
    <div className="space-y-6">
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
          <X className="h-4 w-4 mr-2" />
          フィルターをクリア
        </Button>
      )}

      {/* Years */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          年別
        </h3>
        <div className="space-y-1">
          {years.map(({ year, count }) => (
            <button
              key={year}
              onClick={() =>
                onFilterChange({
                  ...activeFilters,
                  year: activeFilters.year === year ? undefined : year,
                })
              }
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeFilters.year === year
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {year}年
              <span className="float-right text-xs opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <Tag className="h-4 w-4" />
          タグ
        </h3>
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => (
            <Badge
              key={tag.id}
              variant={activeFilters.tagId === tag.id ? "default" : "secondary"}
              className="cursor-pointer"
              onClick={() =>
                onFilterChange({
                  ...activeFilters,
                  tagId: activeFilters.tagId === tag.id ? undefined : tag.id,
                })
              }
            >
              {tag.name}
              <span className="ml-1 opacity-70">({count})</span>
            </Badge>
          ))}
        </div>
      </div>

      {/* Series */}
      <div>
        <h3 className="font-medium mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4" />
          シリーズ
        </h3>
        <div className="space-y-1">
          {series.map(({ series: s, count }) => (
            <button
              key={s.id}
              onClick={() =>
                onFilterChange({
                  ...activeFilters,
                  seriesId: activeFilters.seriesId === s.id ? undefined : s.id,
                })
              }
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                activeFilters.seriesId === s.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {s.title}
              <span className="float-right text-xs opacity-70">({count})</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Archive() {
  const queryParams = useQueryParams();
  const [filters, setFilters] = useState({
    tagId: queryParams.tagId,
    seriesId: queryParams.seriesId,
    year: queryParams.year,
  });
  const [page, setPage] = useState(0);
  const limit = 10;

  const { data: yearsData } = trpc.archive.years.useQuery();
  const { data: tagsData } = trpc.tags.listWithCount.useQuery();
  const { data: seriesData } = trpc.series.listWithCount.useQuery();

  const { data: articlesData, isLoading } = trpc.articles.list.useQuery({
    tagId: filters.tagId,
    seriesId: filters.seriesId,
    year: filters.year,
    limit,
    offset: page * limit,
    orderBy: "newest",
  });

  const totalPages = articlesData ? Math.ceil(articlesData.total / limit) : 0;

  const handleFilterChange = (newFilters: { tagId?: number; seriesId?: number; year?: number }) => {
    setFilters({
      tagId: newFilters.tagId,
      seriesId: newFilters.seriesId,
      year: newFilters.year,
    });
    setPage(0);
  };

  return (
    <Layout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-serif font-bold mb-2">アーカイブ</h1>
          <p className="text-muted-foreground">
            過去の記事を年、タグ、シリーズで検索できます
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <div className="lg:sticky lg:top-24">
              <div className="flex items-center gap-2 mb-4 lg:hidden">
                <Filter className="h-5 w-5" />
                <span className="font-medium">フィルター</span>
              </div>
              <FilterSidebar
                years={yearsData || []}
                tags={tagsData || []}
                series={seriesData || []}
                activeFilters={filters}
                onFilterChange={handleFilterChange}
              />
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1">
            {/* Active Filters Display */}
            {(filters.tagId || filters.seriesId || filters.year) && (
              <div className="mb-6 flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">絞り込み:</span>
                {filters.year && (
                  <Badge variant="outline">
                    {filters.year}年
                    <button
                      onClick={() => handleFilterChange({ ...filters, year: undefined })}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.tagId && tagsData && (
                  <Badge variant="outline">
                    {tagsData.find((t) => t.tag.id === filters.tagId)?.tag.name}
                    <button
                      onClick={() => handleFilterChange({ ...filters, tagId: undefined })}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {filters.seriesId && seriesData && (
                  <Badge variant="outline">
                    {seriesData.find((s) => s.series.id === filters.seriesId)?.series.title}
                    <button
                      onClick={() => handleFilterChange({ ...filters, seriesId: undefined })}
                      className="ml-1"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}

            {/* Results Count */}
            {articlesData && (
              <p className="text-sm text-muted-foreground mb-4">
                {articlesData.total}件の記事
              </p>
            )}

            {/* Articles List */}
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="flex">
                      <Skeleton className="w-48 aspect-square" />
                      <CardContent className="p-4 flex-1">
                        <Skeleton className="h-6 w-3/4 mb-2" />
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-4 w-2/3 mb-3" />
                        <Skeleton className="h-3 w-1/3" />
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            ) : articlesData?.articles && articlesData.articles.length > 0 ? (
              <>
                <div className="space-y-4">
                  {articlesData.articles.map((article) => (
                    <ArticleCardHorizontal key={article.id} article={article} />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      前へ
                    </Button>
                    <span className="flex items-center px-4 text-sm text-muted-foreground">
                      {page + 1} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      次へ
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  条件に一致する記事がありません
                </p>
              </div>
            )}
          </main>
        </div>
      </div>
    </Layout>
  );
}
