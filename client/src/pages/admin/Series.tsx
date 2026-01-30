import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, BarChart3, Plus, Edit, Trash2, Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

function SeriesForm({
  series,
  onSave,
  onCancel,
  isPending,
}: {
  series?: { id: number; title: string; slug: string; description: string | null };
  onSave: (data: { title: string; slug: string; description?: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState(series?.title || "");
  const [slug, setSlug] = useState(series?.slug || "");
  const [description, setDescription] = useState(series?.description || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ title, slug, description: description || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="title">シリーズ名 *</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (!series) {
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }
          }}
          placeholder="シリーズ名"
          required
        />
      </div>
      <div>
        <Label htmlFor="slug">スラッグ *</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="series-slug"
          required
        />
      </div>
      <div>
        <Label htmlFor="description">説明</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="シリーズの説明"
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit" disabled={isPending}>
          <Save className="h-4 w-4 mr-2" />
          {isPending ? "保存中..." : "保存"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminSeries() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [editingSeries, setEditingSeries] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: seriesList, isLoading } = trpc.series.listWithCount.useQuery();

  const createSeries = trpc.series.create.useMutation({
    onSuccess: () => {
      utils.series.listWithCount.invalidate();
      setIsCreateOpen(false);
      toast.success("シリーズを作成しました");
    },
    onError: (error) => {
      toast.error("作成に失敗しました: " + error.message);
    },
  });

  const updateSeries = trpc.series.update.useMutation({
    onSuccess: () => {
      utils.series.listWithCount.invalidate();
      setEditingSeries(null);
      toast.success("シリーズを更新しました");
    },
    onError: (error) => {
      toast.error("更新に失敗しました: " + error.message);
    },
  });

  const deleteSeries = trpc.series.delete.useMutation({
    onSuccess: () => {
      utils.series.listWithCount.invalidate();
      toast.success("シリーズを削除しました");
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
              <h1 className="text-3xl font-serif font-bold mb-2">シリーズ管理</h1>
              <p className="text-muted-foreground">
                記事のシリーズを作成・管理できます
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新規シリーズ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規シリーズを作成</DialogTitle>
                </DialogHeader>
                <SeriesForm
                  onSave={(data) => createSeries.mutate(data)}
                  onCancel={() => setIsCreateOpen(false)}
                  isPending={createSeries.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-24 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : seriesList && seriesList.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {seriesList.map(({ series, count }) => (
                <Card key={series.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <BookOpen className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{series.title}</h3>
                          <Badge variant="secondary">{count}件</Badge>
                        </div>
                        {series.description && (
                          <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                            {series.description}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          /{series.slug}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Dialog
                          open={editingSeries?.id === series.id}
                          onOpenChange={(open) => !open && setEditingSeries(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingSeries(series)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>シリーズを編集</DialogTitle>
                            </DialogHeader>
                            <SeriesForm
                              series={series}
                              onSave={(data) =>
                                updateSeries.mutate({ id: series.id, ...data })
                              }
                              onCancel={() => setEditingSeries(null)}
                              isPending={updateSeries.isPending}
                            />
                          </DialogContent>
                        </Dialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>シリーズを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                このシリーズを削除すると、関連する記事からシリーズ情報が削除されます。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteSeries.mutate({ id: series.id })}
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
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">シリーズがありません</p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  最初のシリーズを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </Layout>
  );
}
