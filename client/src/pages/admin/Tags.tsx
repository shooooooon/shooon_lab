import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, BarChart3, Plus, Edit, Trash2, Save, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

function TagForm({
  tag,
  onSave,
  onCancel,
  isPending,
}: {
  tag?: { id: number; name: string; slug: string; color: string | null };
  onSave: (data: { name: string; slug: string; color: string }) => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(tag?.name || "");
  const [slug, setSlug] = useState(tag?.slug || "");
  const [color, setColor] = useState(tag?.color || "#6b7280");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ name, slug, color });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">タグ名 *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!tag) {
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
            }
          }}
          placeholder="タグ名"
          required
        />
      </div>
      <div>
        <Label htmlFor="slug">スラッグ *</Label>
        <Input
          id="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="tag-slug"
          required
        />
      </div>
      <div>
        <Label htmlFor="color">カラー</Label>
        <div className="flex gap-2">
          <Input
            id="color"
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-16 h-10 p-1"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#6b7280"
            className="flex-1"
          />
        </div>
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

export default function AdminTags() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [editingTag, setEditingTag] = useState<any>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data: tags, isLoading } = trpc.tags.listWithCount.useQuery();

  const createTag = trpc.tags.create.useMutation({
    onSuccess: () => {
      utils.tags.listWithCount.invalidate();
      setIsCreateOpen(false);
      toast.success("タグを作成しました");
    },
    onError: (error) => {
      toast.error("作成に失敗しました: " + error.message);
    },
  });

  const updateTag = trpc.tags.update.useMutation({
    onSuccess: () => {
      utils.tags.listWithCount.invalidate();
      setEditingTag(null);
      toast.success("タグを更新しました");
    },
    onError: (error) => {
      toast.error("更新に失敗しました: " + error.message);
    },
  });

  const deleteTag = trpc.tags.delete.useMutation({
    onSuccess: () => {
      utils.tags.listWithCount.invalidate();
      toast.success("タグを削除しました");
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
              <h1 className="text-3xl font-serif font-bold mb-2">タグ管理</h1>
              <p className="text-muted-foreground">
                記事のタグを作成・管理できます
              </p>
            </div>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  新規タグ
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規タグを作成</DialogTitle>
                </DialogHeader>
                <TagForm
                  onSave={(data) => createTag.mutate(data)}
                  onCancel={() => setIsCreateOpen(false)}
                  isPending={createTag.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="h-20 animate-pulse bg-muted rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : tags && tags.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tags.map(({ tag, count }) => (
                <Card key={tag.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge
                            style={{ backgroundColor: tag.color || "#6b7280" }}
                            className="text-white"
                          >
                            {tag.name}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            ({count}件)
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          /{tag.slug}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Dialog
                          open={editingTag?.id === tag.id}
                          onOpenChange={(open) => !open && setEditingTag(null)}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingTag(tag)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>タグを編集</DialogTitle>
                            </DialogHeader>
                            <TagForm
                              tag={tag}
                              onSave={(data) =>
                                updateTag.mutate({ id: tag.id, ...data })
                              }
                              onCancel={() => setEditingTag(null)}
                              isPending={updateTag.isPending}
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
                              <AlertDialogTitle>タグを削除しますか？</AlertDialogTitle>
                              <AlertDialogDescription>
                                このタグを削除すると、関連する記事からも削除されます。
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>キャンセル</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteTag.mutate({ id: tag.id })}
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
                <Tag className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">タグがありません</p>
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  最初のタグを作成
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </Layout>
  );
}
