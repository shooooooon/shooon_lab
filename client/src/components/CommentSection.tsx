import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Reply, User, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CommentSectionProps {
  articleId: number;
}

interface Comment {
  id: number;
  content: string;
  parentId: number | null;
  status: string;
  createdAt: Date;
  author: {
    id: number;
    name: string | null;
  } | null;
}

// Single Comment Component
function CommentItem({
  comment,
  onReply,
  depth = 0,
}: {
  comment: Comment;
  onReply: (parentId: number) => void;
  depth?: number;
}) {
  const maxDepth = 3;

  return (
    <div className={depth > 0 ? "comment-thread" : ""}>
      <div className="py-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">
                {comment.author?.name || "匿名ユーザー"}
              </span>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {new Date(comment.createdAt).toLocaleDateString("ja-JP", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap">
              {comment.content}
            </p>
            {depth < maxDepth && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-muted-foreground hover:text-foreground"
                onClick={() => onReply(comment.id)}
              >
                <Reply className="h-4 w-4 mr-1" />
                返信
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Comment Form
function CommentForm({
  articleId,
  parentId,
  onCancel,
  onSuccess,
}: {
  articleId: number;
  parentId?: number;
  onCancel?: () => void;
  onSuccess?: () => void;
}) {
  const [content, setContent] = useState("");
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const createComment = trpc.comments.create.useMutation({
    onSuccess: () => {
      setContent("");
      utils.comments.listByArticle.invalidate({ articleId });
      toast.success(
        "コメントを投稿しました。承認後に表示されます。"
      );
      onSuccess?.();
    },
    onError: (error) => {
      toast.error("コメントの投稿に失敗しました: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    createComment.mutate({
      articleId,
      content: content.trim(),
      parentId,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="text-center py-6 bg-muted/50 rounded-lg">
        <p className="text-muted-foreground mb-4">
          コメントを投稿するにはログインが必要です
        </p>
        <Button asChild>
          <a href={getLoginUrl()}>ログインする</a>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={parentId ? "返信を入力..." : "コメントを入力..."}
        rows={3}
        className="resize-none"
      />
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            キャンセル
          </Button>
        )}
        <Button
          type="submit"
          disabled={!content.trim() || createComment.isPending}
        >
          {createComment.isPending ? "投稿中..." : "投稿する"}
        </Button>
      </div>
    </form>
  );
}

// Build comment tree
function buildCommentTree(comments: Comment[]): (Comment & { replies: Comment[] })[] {
  const commentMap = new Map<number, Comment & { replies: Comment[] }>();
  const rootComments: (Comment & { replies: Comment[] })[] = [];

  // Initialize all comments with empty replies array
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // Build tree structure
  comments.forEach((comment) => {
    const commentWithReplies = commentMap.get(comment.id)!;
    if (comment.parentId && commentMap.has(comment.parentId)) {
      commentMap.get(comment.parentId)!.replies.push(commentWithReplies);
    } else {
      rootComments.push(commentWithReplies);
    }
  });

  return rootComments;
}

// Recursive comment renderer
function CommentThread({
  comment,
  onReply,
  depth = 0,
}: {
  comment: Comment & { replies: Comment[] };
  onReply: (parentId: number) => void;
  depth?: number;
}) {
  return (
    <>
      <CommentItem comment={comment} onReply={onReply} depth={depth} />
      {comment.replies.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply as Comment & { replies: Comment[] }}
          onReply={onReply}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export default function CommentSection({ articleId }: CommentSectionProps) {
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const { data: comments, isLoading } = trpc.comments.listByArticle.useQuery({
    articleId,
  });

  const commentTree = comments ? buildCommentTree(comments as Comment[]) : [];

  return (
    <section>
      <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        コメント
        {comments && comments.length > 0 && (
          <span className="text-sm font-normal text-muted-foreground">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* Comment Form */}
      <div className="mb-8">
        <CommentForm articleId={articleId} />
      </div>

      {/* Comments List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32 mb-2" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : commentTree.length > 0 ? (
        <div className="divide-y divide-border">
          {commentTree.map((comment) => (
            <div key={comment.id}>
              <CommentThread
                comment={comment}
                onReply={(parentId) => setReplyingTo(parentId)}
              />
              {replyingTo === comment.id && (
                <div className="ml-13 mb-4">
                  <CommentForm
                    articleId={articleId}
                    parentId={comment.id}
                    onCancel={() => setReplyingTo(null)}
                    onSuccess={() => setReplyingTo(null)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>まだコメントはありません</p>
          <p className="text-sm">最初のコメントを投稿してみましょう</p>
        </div>
      )}
    </section>
  );
}
