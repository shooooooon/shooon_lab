import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, BarChart3, Check, X, Trash2, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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

export default function AdminComments() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();

  const { data: pendingComments, isLoading } = trpc.comments.listPending.useQuery();

  const approveComment = trpc.comments.approve.useMutation({
    onSuccess: () => {
      utils.comments.listPending.invalidate();
      toast.success("コメントを承認しました");
    },
    onError: (error) => {
      toast.error("承認に失敗しました: " + error.message);
    },
  });

  const rejectComment = trpc.comments.reject.useMutation({
    onSuccess: () => {
      utils.comments.listPending.invalidate();
      toast.success("コメントを却下しました");
    },
    onError: (error) => {
      toast.error("却下に失敗しました: " + error.message);
    },
  });

  const deleteComment = trpc.comments.delete.useMutation({
    onSuccess: () => {
      utils.comments.listPending.invalidate();
      toast.success("コメントを削除しました");
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
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold mb-2">コメント管理</h1>
            <p className="text-muted-foreground">
              承認待ちのコメントを確認・管理できます
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : pendingComments && pendingComments.length > 0 ? (
            <div className="space-y-4">
              {pendingComments.map((comment) => (
                <Card key={comment.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium">
                            {comment.author?.name || "匿名ユーザー"}
                          </span>
                          <Badge variant="outline">承認待ち</Badge>
                        </div>
                        <p className="text-sm mb-3 whitespace-pre-wrap">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>
                            {new Date(comment.createdAt).toLocaleString("ja-JP")}
                          </span>
                          {comment.article && (
                            <>
                              <span>•</span>
                              <Link
                                href={`/article/${comment.article.slug}`}
                                className="flex items-center gap-1 hover:text-primary"
                              >
                                {comment.article.title}
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => approveComment.mutate({ id: comment.id })}
                          disabled={approveComment.isPending}
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          <Check className="h-4 w-4 mr-1" />
                          承認
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => rejectComment.mutate({ id: comment.id })}
                          disabled={rejectComment.isPending}
                          className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        >
                          <X className="h-4 w-4 mr-1" />
                          却下
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>コメントを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                この操作は取り消せません。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteComment.mutate({ id: comment.id })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                削除
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">
                  承認待ちのコメントはありません
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </Layout>
  );
}
