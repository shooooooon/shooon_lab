import Layout from "@/components/Layout";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Link, useParams, useLocation } from "wouter";
import { 
  FileText, MessageSquare, Tag, BookOpen, 
  PenSquare, BarChart3, ArrowLeft, Save, Eye, Image, Plus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useState, useEffect } from "react";

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

// Generate slug from title
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export default function AdminArticleEditor() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const isEditing = !!params.id;

  // Form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState("");
  const [status, setStatus] = useState<"draft" | "published" | "archived">("draft");
  const [weight, setWeight] = useState(0);
  const [seriesId, setSeriesId] = useState<number | null>(null);
  const [seriesOrder, setSeriesOrder] = useState<number | null>(null);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");

  // Fetch existing article if editing
  const { data: article, isLoading: articleLoading } = trpc.articles.getById.useQuery(
    { id: parseInt(params.id || "0") },
    { enabled: isEditing }
  );

  // Fetch tags and series for selection
  const { data: tags } = trpc.tags.list.useQuery();
  const { data: seriesList } = trpc.series.list.useQuery();

  // Populate form when article data loads
  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setSlug(article.slug);
      setExcerpt(article.excerpt || "");
      setContent(article.content);
      setCoverImage(article.coverImage || "");
      setStatus(article.status);
      setWeight(article.weight);
      setSeriesId(article.seriesId);
      setSeriesOrder(article.seriesOrder);
      setSelectedTags(article.tags?.map((t) => t.id) || []);
      setGallery(article.gallery || []);
    }
  }, [article]);

  // Auto-generate slug from title (only for new articles)
  useEffect(() => {
    if (!isEditing && title) {
      setSlug(generateSlug(title));
    }
  }, [title, isEditing]);

  const createArticle = trpc.articles.create.useMutation({
    onSuccess: (data) => {
      toast.success("記事を作成しました");
      navigate(`/admin/articles/${data.id}/edit`);
    },
    onError: (error) => {
      toast.error("作成に失敗しました: " + error.message);
    },
  });

  const updateArticle = trpc.articles.update.useMutation({
    onSuccess: () => {
      utils.articles.getById.invalidate({ id: parseInt(params.id || "0") });
      toast.success("記事を更新しました");
    },
    onError: (error) => {
      toast.error("更新に失敗しました: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = {
      title,
      slug,
      excerpt: excerpt || undefined,
      content,
      coverImage: coverImage || undefined,
      status,
      weight,
      seriesId: seriesId || undefined,
      seriesOrder: seriesOrder || undefined,
      tagIds: selectedTags,
      gallery: gallery.length > 0 ? gallery : undefined,
    };

    if (isEditing) {
      updateArticle.mutate({ id: parseInt(params.id!), ...data });
    } else {
      createArticle.mutate(data);
    }
  };

  const addGalleryImage = () => {
    if (newGalleryUrl && !gallery.includes(newGalleryUrl)) {
      setGallery([...gallery, newGalleryUrl]);
      setNewGalleryUrl("");
    }
  };

  const removeGalleryImage = (url: string) => {
    setGallery(gallery.filter((g) => g !== url));
  };

  const toggleTag = (tagId: number) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter((id) => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

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

  if (isEditing && articleLoading) {
    return (
      <Layout>
        <div className="flex">
          <AdminSidebar />
          <main className="flex-1 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/4" />
              <div className="h-64 bg-muted rounded" />
            </div>
          </main>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex">
        <AdminSidebar />
        <main className="flex-1 p-6">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Link href="/admin/articles">
                  <Button variant="ghost" size="icon">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-serif font-bold">
                    {isEditing ? "記事を編集" : "新規記事"}
                  </h1>
                </div>
              </div>
              <div className="flex gap-2">
                {isEditing && article?.status === "published" && (
                  <Link href={`/article/${article.slug}`}>
                    <Button variant="outline" type="button">
                      <Eye className="h-4 w-4 mr-2" />
                      プレビュー
                    </Button>
                  </Link>
                )}
                <Button
                  type="submit"
                  disabled={createArticle.isPending || updateArticle.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {createArticle.isPending || updateArticle.isPending
                    ? "保存中..."
                    : "保存"}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Content */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>基本情報</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="title">タイトル *</Label>
                      <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="記事のタイトル"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="slug">スラッグ *</Label>
                      <Input
                        id="slug"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        placeholder="url-friendly-slug"
                        required
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        URLに使用されます: /article/{slug || "..."}
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="excerpt">抜粋</Label>
                      <Textarea
                        id="excerpt"
                        value={excerpt}
                        onChange={(e) => setExcerpt(e.target.value)}
                        placeholder="記事の概要（一覧表示で使用）"
                        rows={2}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>本文 *</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="Markdown形式で記事を書いてください..."
                      rows={20}
                      className="font-mono text-sm"
                      required
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      Markdown形式に対応しています
                    </p>
                  </CardContent>
                </Card>

                {/* Gallery */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Image className="h-5 w-5" />
                      ギャラリー
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex gap-2 mb-4">
                      <Input
                        value={newGalleryUrl}
                        onChange={(e) => setNewGalleryUrl(e.target.value)}
                        placeholder="画像URLを入力"
                      />
                      <Button type="button" onClick={addGalleryImage}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {gallery.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {gallery.map((url, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={url}
                              alt={`Gallery ${index + 1}`}
                              className="w-full aspect-square object-cover rounded"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(url)}
                              className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>公開設定</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="status">ステータス</Label>
                      <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">下書き</SelectItem>
                          <SelectItem value="published">公開</SelectItem>
                          <SelectItem value="archived">アーカイブ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="weight">特集記事の重み</Label>
                      <Input
                        id="weight"
                        type="number"
                        min={0}
                        value={weight}
                        onChange={(e) => setWeight(parseInt(e.target.value) || 0)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        0より大きい値で特集記事として表示
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>カバー画像</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Input
                      value={coverImage}
                      onChange={(e) => setCoverImage(e.target.value)}
                      placeholder="画像URL"
                    />
                    {coverImage && (
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        className="mt-2 w-full aspect-video object-cover rounded"
                      />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>シリーズ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>シリーズを選択</Label>
                      <Select
                        value={seriesId?.toString() || "none"}
                        onValueChange={(v) => setSeriesId(v === "none" ? null : parseInt(v))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="シリーズなし" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">シリーズなし</SelectItem>
                          {seriesList?.map((s) => (
                            <SelectItem key={s.id} value={s.id.toString()}>
                              {s.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {seriesId && (
                      <div>
                        <Label htmlFor="seriesOrder">シリーズ内の順番</Label>
                        <Input
                          id="seriesOrder"
                          type="number"
                          min={1}
                          value={seriesOrder || ""}
                          onChange={(e) =>
                            setSeriesOrder(parseInt(e.target.value) || null)
                          }
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>タグ</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {tags?.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant={selectedTags.includes(tag.id) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleTag(tag.id)}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                    {tags?.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        タグがありません。
                        <Link href="/admin/tags" className="text-primary hover:underline">
                          タグを作成
                        </Link>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </form>
        </main>
      </div>
    </Layout>
  );
}
