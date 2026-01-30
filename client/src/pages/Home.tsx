import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import { Calendar, Eye, ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { ArticleCard } from "@/components/ArticleCard";

// Featured Article Slider
function FeaturedSlider() {
  const { data: featured, isLoading } = trpc.articles.featured.useQuery({ limit: 5 });
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!featured || featured.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % featured.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [featured]);

  if (isLoading) {
    return (
      <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (!featured || featured.length === 0) {
    return (
      <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">特集記事がありません</p>
      </div>
    );
  }

  const currentArticle = featured[currentIndex];

  return (
    <div className="relative h-[400px] md:h-[500px] rounded-xl overflow-hidden group">
      {/* Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{
          backgroundImage: currentArticle.coverImage
            ? `url(${currentArticle.coverImage})`
            : "linear-gradient(135deg, var(--charcoal) 0%, var(--charcoal-light) 100%)",
        }}
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
        <div className="max-w-3xl">
          <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full mb-4">
            特集記事
          </span>
          <h2 className="text-2xl md:text-4xl font-serif font-bold text-white mb-3">
            {currentArticle.title}
          </h2>
          {currentArticle.excerpt && (
            <p className="text-white/80 text-sm md:text-base mb-4 line-clamp-2">
              {currentArticle.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 text-white/70 text-sm mb-4">
            {currentArticle.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(currentArticle.publishedAt).toLocaleDateString("ja-JP")}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {currentArticle.viewCount} views
            </span>
          </div>
          <Link href={`/article/${currentArticle.slug}`}>
            <Button variant="secondary" className="group/btn">
              続きを読む
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Navigation Arrows */}
      {featured.length > 1 && (
        <>
          <button
            onClick={() => setCurrentIndex((prev) => (prev - 1 + featured.length) % featured.length)}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => (prev + 1) % featured.length)}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/30 hover:bg-black/50 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Dots */}
      {featured.length > 1 && (
        <div className="absolute bottom-4 right-6 md:right-10 flex gap-2">
          {featured.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`w-2 h-2 rounded-full transition-all ${
                index === currentIndex
                  ? "bg-white w-6"
                  : "bg-white/50 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// #13: ArticleCardを共通コンポーネントに移動済み

// Article List Skeleton
function ArticleListSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(6)].map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <Skeleton className="aspect-video" />
          <CardContent className="p-4">
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-full mb-1" />
            <Skeleton className="h-4 w-2/3 mb-3" />
            <Skeleton className="h-3 w-1/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Home() {
  const { data, isLoading } = trpc.articles.list.useQuery({
    limit: 9,
    orderBy: "newest",
  });

  return (
    <Layout>
      <div className="container py-8">
        {/* Featured Slider */}
        <section className="mb-12">
          <FeaturedSlider />
        </section>

        {/* Latest Articles */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-serif font-bold">最新の記事</h2>
            <Link href="/archive">
              <Button variant="ghost" className="group">
                すべて見る
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <ArticleListSkeleton />
          ) : data?.articles && data.articles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">まだ記事がありません</p>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
