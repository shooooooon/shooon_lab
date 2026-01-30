import { Link } from "wouter";
import { Calendar, Eye, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { AppRouter } from "../../../server/routers";
import type { inferRouterOutputs } from "@trpc/server";

// #13: 型安全なArticleCardコンポーネント
type ArticleListOutput = inferRouterOutputs<AppRouter>["articles"]["list"];
type ArticleItem = ArticleListOutput["articles"][number];

interface ArticleCardProps {
  article: ArticleItem;
  showExcerpt?: boolean;
}

export function ArticleCard({ article, showExcerpt = true }: ArticleCardProps) {
  return (
    <article className="group">
      <Link href={`/article/${article.slug}`}>
        <div className="block">
          {article.coverImage && (
            <div className="aspect-video overflow-hidden rounded-lg mb-4">
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <h3 className="text-xl font-serif font-semibold mb-2 group-hover:text-primary transition-colors">
            {article.title}
          </h3>
          {showExcerpt && article.excerpt && (
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
              {article.excerpt}
            </p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {article.publishedAt && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(article.publishedAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {article.viewCount}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

// シンプルなカードバリエーション（リスト表示用）
export function ArticleCardCompact({ article }: { article: ArticleItem }) {
  return (
    <article className="group py-4 border-b border-border last:border-0">
      <Link href={`/article/${article.slug}`}>
        <div className="flex gap-4">
          {article.coverImage && (
            <div className="w-24 h-24 flex-shrink-0 overflow-hidden rounded-lg">
              <img
                src={article.coverImage}
                alt={article.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-semibold mb-1 group-hover:text-primary transition-colors line-clamp-2">
              {article.title}
            </h3>
            {article.excerpt && (
              <p className="text-muted-foreground text-sm mb-2 line-clamp-1">
                {article.excerpt}
              </p>
            )}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {article.publishedAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(article.publishedAt).toLocaleDateString("ja-JP", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {article.viewCount}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default ArticleCard;
