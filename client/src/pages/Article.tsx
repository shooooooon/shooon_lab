import Layout from "@/components/Layout";
import { trpc } from "@/lib/trpc";
import { useParams, Link } from "wouter";
import { Calendar, Eye, ArrowLeft, Tag, BookOpen, Share2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Streamdown } from "streamdown";
import { useState, useEffect, useRef } from "react";
import CommentSection from "@/components/CommentSection";

// Gallery Component
function Gallery({ images }: { images: string[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <div className="my-8">
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <ExternalLink className="h-5 w-5" />
        ギャラリー
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {images.map((image, index) => (
          <Dialog key={index}>
            <DialogTrigger asChild>
              <button
                className="aspect-square overflow-hidden rounded-lg hover:opacity-90 transition-opacity"
                onClick={() => setSelectedImage(image)}
              >
                <img
                  src={image}
                  alt={`Gallery image ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl p-0 overflow-hidden">
              <img
                src={image}
                alt={`Gallery image ${index + 1}`}
                className="w-full h-auto"
              />
            </DialogContent>
          </Dialog>
        ))}
      </div>
    </div>
  );
}

// Footnotes Component
function Footnotes({ footnotes }: { footnotes: { id: string; content: string }[] }) {
  if (!footnotes || footnotes.length === 0) return null;

  return (
    <div className="footnote-content">
      <h3 className="text-lg font-semibold mb-4">脚注</h3>
      <ol className="list-decimal list-inside space-y-2">
        {footnotes.map((footnote, index) => (
          <li key={footnote.id} id={`footnote-${footnote.id}`} className="text-sm">
            <span className="text-muted-foreground">{footnote.content}</span>
            <a
              href={`#ref-${footnote.id}`}
              className="ml-2 text-primary hover:underline"
            >
              ↩
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Series Navigation
function SeriesNavigation({ series, currentArticleId }: { series: any; currentArticleId: number }) {
  const { data: seriesArticles } = trpc.articles.list.useQuery({
    seriesId: series.id,
    limit: 100,
    orderBy: "oldest",
  });

  if (!seriesArticles?.articles || seriesArticles.articles.length <= 1) return null;

  const currentIndex = seriesArticles.articles.findIndex((a) => a.id === currentArticleId);
  const prevArticle = currentIndex > 0 ? seriesArticles.articles[currentIndex - 1] : null;
  const nextArticle = currentIndex < seriesArticles.articles.length - 1 ? seriesArticles.articles[currentIndex + 1] : null;

  return (
    <div className="my-8 p-6 bg-muted/50 rounded-lg">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-primary" />
        <span className="font-medium">シリーズ: {series.title}</span>
        <Badge variant="secondary" className="ml-auto">
          {currentIndex + 1} / {seriesArticles.articles.length}
        </Badge>
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        {prevArticle && (
          <Link href={`/article/${prevArticle.slug}`} className="flex-1">
            <Button variant="outline" className="w-full justify-start">
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="truncate">{prevArticle.title}</span>
            </Button>
          </Link>
        )}
        {nextArticle && (
          <Link href={`/article/${nextArticle.slug}`} className="flex-1">
            <Button variant="outline" className="w-full justify-end">
              <span className="truncate">{nextArticle.title}</span>
              <ArrowLeft className="ml-2 h-4 w-4 rotate-180" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

// Article Skeleton
function ArticleSkeleton() {
  return (
    <div className="container max-w-4xl py-8">
      <Skeleton className="h-8 w-24 mb-4" />
      <Skeleton className="h-12 w-3/4 mb-4" />
      <div className="flex gap-4 mb-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-24" />
      </div>
      <Skeleton className="aspect-video w-full mb-8 rounded-lg" />
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}

export default function Article() {
  const params = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = trpc.articles.getBySlug.useQuery(
    { slug: params.slug || "" },
    { enabled: !!params.slug }
  );

  // #2, #A: ビューカウントのインクリメントを別のmutationに分離し、重複実行を防止
  const incrementViewMutation = trpc.articles.incrementView.useMutation();
  const hasIncrementedRef = useRef(false);
  useEffect(() => {
    if (params.slug && article && !hasIncrementedRef.current) {
      hasIncrementedRef.current = true;
      incrementViewMutation.mutate({ slug: params.slug });
    }
  }, [params.slug, article?.id]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          url: window.location.href,
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <ArticleSkeleton />
      </Layout>
    );
  }

  if (error || !article) {
    return (
      <Layout>
        <div className="container max-w-4xl py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">記事が見つかりません</h1>
          <p className="text-muted-foreground mb-6">
            お探しの記事は存在しないか、削除された可能性があります。
          </p>
          <Link href="/">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              ホームに戻る
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <article className="container max-w-4xl py-8">
        {/* Back Link */}
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="mr-2 h-4 w-4" />
            戻る
          </Button>
        </Link>

        {/* Article Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {article.title}
          </h1>

          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-4">
            {article.author && (
              <span>by {article.author.name || "Anonymous"}</span>
            )}
            {article.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(article.publishedAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              {article.viewCount} views
            </span>
            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              共有
            </Button>
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {article.tags.map((tag) => (
                <Link key={tag.id} href={`/archive?tagId=${tag.id}`}>
                  <Badge
                    variant="secondary"
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    style={{ borderColor: tag.color || undefined }}
                  >
                    <Tag className="h-3 w-3 mr-1" />
                    {tag.name}
                  </Badge>
                </Link>
              ))}
            </div>
          )}

          {/* Series Info */}
          {article.series && (
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-primary" />
              <span>シリーズ:</span>
              <Link
                href={`/archive?seriesId=${article.series.id}`}
                className="text-primary hover:underline"
              >
                {article.series.title}
              </Link>
            </div>
          )}
        </header>

        {/* Cover Image */}
        {article.coverImage && (
          <div className="aspect-video overflow-hidden rounded-lg mb-8">
            <img
              src={article.coverImage}
              alt={article.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Excerpt */}
        {article.excerpt && (
          <div className="text-lg text-muted-foreground italic border-l-4 border-primary pl-4 mb-8">
            {article.excerpt}
          </div>
        )}

        {/* Article Content */}
        <div className="prose">
          <Streamdown>{article.content}</Streamdown>
        </div>

        {/* Gallery */}
        {article.gallery && <Gallery images={article.gallery} />}

        {/* Footnotes */}
        {article.footnotes && <Footnotes footnotes={article.footnotes} />}

        {/* Series Navigation */}
        {article.series && (
          <SeriesNavigation series={article.series} currentArticleId={article.id} />
        )}

        <Separator className="my-8" />

        {/* Comments Section */}
        <CommentSection articleId={article.id} />
      </article>
    </Layout>
  );
}
