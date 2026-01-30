import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, BarChart3, Plus, Edit, Trash2, Eye, EyeOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useState } from "react";

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
          const isActive = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
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

export default function AdminArticles() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();

  const { data: articlesData, isLoading } = trpc.articles.listAll.useQuery({
    limit: 50,
  });

  const deleteArticle = trpc.articles.delete.useMutation({
    onSuccess: () => {
      utils.articles.listAll.invalidate();
      toast.success("記事を削除しました");
    },
    onError: (error) => {
      toast.error("削除に失敗しました: " + error.message);
    },
  });

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

  return (
    <Layout>
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-serif font-bold mb-2">記事管理</h1>
              <p className="text-muted-foreground">
                記事の作成、編集、削除ができます
              </p>
            </div>
            <Link href="/admin/articles/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新規記事
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : articlesData?.articles && articlesData.articles.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>タイトル</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead>重み</TableHead>
                      <TableHead>閲覧数</TableHead>
                      <TableHead>更新日</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {articlesData.articles.map((article) => (
                      <TableRow key={article.id}>
                        <TableCell className="font-medium max-w-xs truncate">
                          {article.title}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              article.status === "published"
                                ? "default"
                                : article.status === "draft"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {article.status === "published"
                              ? "公開"
                              : article.status === "draft"
                              ? "下書き"
                              : "アーカイブ"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {article.weight > 0 ? (
                            <Badge variant="outline" className="bg-primary/10">
                              {article.weight}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{article.viewCount}</TableCell>
                        <TableCell>
                          {new Date(article.updatedAt).toLocaleDateString("ja-JP")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {article.status === "published" && (
                              <Link href={`/article/${article.slug}`}>
                                <Button variant="ghost" size="icon">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                            <Link href={`/admin/articles/${article.id}/edit`}>
                              <Button variant="ghost" size="icon">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>記事を削除しますか？</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    この操作は取り消せません。記事に関連するコメントも削除されます。
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>キャンセル</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteArticle.mutate({ id: article.id })}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    削除
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">記事がありません</p>
                  <Link href="/admin/articles/new">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      最初の記事を作成
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </Layout>
  );
}
