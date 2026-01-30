import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, Settings, BarChart3, Clock 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function AdminSidebar() {
  const [location] = useLocation();
  
  const menuItems = [
    { href: "/admin", label: "ダッシュボード", icon: BarChart3 },
    { href: "/admin/articles", label: "記事管理", icon: FileText },
    { href: "/admin/articles/new", label: "新規記事", icon: PenSquare },
    { href: "/admin/comments", label: "コメント", icon: MessageSquare },
    { href: "/admin/tags", label: "タグ管理", icon: Tag },
    { href: "/admin/series", label: "シリーズ管理", icon: BookOpen },
  ];

  return (
    <aside className="w-64 border-r border-border bg-muted/30 min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                className="w-full justify-start"
              >
                <Icon className="h-4 w-4 mr-2" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  loading 
}: { 
  title: string; 
  value: number | string; 
  icon: any; 
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: articlesData, isLoading: articlesLoading } = trpc.articles.listAll.useQuery({
    limit: 5,
  });
  
  const { data: pendingComments, isLoading: commentsLoading } = trpc.comments.listPending.useQuery();
  const { data: tags, isLoading: tagsLoading } = trpc.tags.list.useQuery();
  const { data: seriesList, isLoading: seriesLoading } = trpc.series.list.useQuery();

  // Redirect non-admin users
  if (!authLoading && (!isAuthenticated || user?.role !== "admin")) {
    return (
      <Layout>
        <div className="container py-16 text-center">
          <h1 className="text-2xl font-bold mb-4">アクセス権限がありません</h1>
          <p className="text-muted-foreground mb-6">
            このページは管理者のみアクセスできます。
          </p>
          <Link href="/">
            <Button>ホームに戻る</Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const publishedCount = articlesData?.articles.filter(a => a.status === "published").length ?? 0;
  const draftCount = articlesData?.articles.filter(a => a.status === "draft").length ?? 0;

  return (
    <Layout>
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold mb-2">ダッシュボード</h1>
            <p className="text-muted-foreground">
              ブログの統計情報と管理機能にアクセスできます
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="公開記事"
              value={publishedCount}
              icon={FileText}
              loading={articlesLoading}
            />
            <StatCard
              title="下書き"
              value={draftCount}
              icon={PenSquare}
              loading={articlesLoading}
            />
            <StatCard
              title="承認待ちコメント"
              value={pendingComments?.length ?? 0}
              icon={MessageSquare}
              loading={commentsLoading}
            />
            <StatCard
              title="タグ数"
              value={tags?.length ?? 0}
              icon={Tag}
              loading={tagsLoading}
            />
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Articles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  最近の記事
                </CardTitle>
              </CardHeader>
              <CardContent>
                {articlesLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : articlesData?.articles && articlesData.articles.length > 0 ? (
                  <div className="space-y-3">
                    {articlesData.articles.slice(0, 5).map((article) => (
                      <Link
                        key={article.id}
                        href={`/admin/articles/${article.id}/edit`}
                        className="block p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">
                            {article.title}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              article.status === "published"
                                ? "bg-green-100 text-green-700"
                                : article.status === "draft"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {article.status === "published"
                              ? "公開"
                              : article.status === "draft"
                              ? "下書き"
                              : "アーカイブ"}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    記事がありません
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Pending Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  承認待ちコメント
                </CardTitle>
              </CardHeader>
              <CardContent>
                {commentsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : pendingComments && pendingComments.length > 0 ? (
                  <div className="space-y-3">
                    {pendingComments.slice(0, 5).map((comment) => (
                      <div
                        key={comment.id}
                        className="p-3 rounded-lg bg-muted/50"
                      >
                        <p className="text-sm line-clamp-2 mb-1">
                          {comment.content}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {comment.author?.name || "匿名"} - {comment.article?.title}
                        </p>
                      </div>
                    ))}
                    <Link href="/admin/comments">
                      <Button variant="outline" size="sm" className="w-full">
                        すべて見る
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    承認待ちのコメントはありません
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </Layout>
  );
}
