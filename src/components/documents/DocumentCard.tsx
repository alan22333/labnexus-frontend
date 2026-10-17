import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BookOpenText, MessageCircle, Pencil, Pin, ThumbsUp } from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { TagBadges } from "@/components/common/TagBadges"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth"
import { documentApi } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import type { Document, Folder } from "@/lib/types"
import { cn } from "@/lib/utils"

import { CommentsDialog } from "./CommentsDialog"
import { DocumentEditorDialog } from "./DocumentEditorDialog"
import { RichContent } from "./RichContent"

// 会话内点赞记录(用于按钮高亮)
const sessionLiked = new Set<string>()

interface Props {
  doc: Document
  folders?: Folder[]
  onChanged?: () => void
}

/** 信息流帖子卡片 */
export function DocumentCard({ doc, folders, onChanged }: Props) {
  const { user } = useAuth()
  const [count, setCount] = useState(doc.reactions_count ?? 0)
  const [commentCount, setCommentCount] = useState(doc.comments_count ?? 0)
  const [liked, setLiked] = useState(sessionLiked.has(doc.id))
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const isMine = user != null && doc.author_id === user.id

  useEffect(() => {
    setCount(doc.reactions_count ?? 0)
    setCommentCount(doc.comments_count ?? 0)
    setLiked(sessionLiked.has(doc.id))
  }, [doc.id, doc.reactions_count, doc.comments_count])

  async function toggleLike() {
    const next = !liked
    setLiked(next)
    setCount((c) => c + (next ? 1 : -1))
    try {
      await documentApi.toggleReaction(doc.id)
      if (next) sessionLiked.add(doc.id)
      else sessionLiked.delete(doc.id)
    } catch (err) {
      // 回滚
      setLiked(!next)
      setCount((c) => c + (next ? -1 : 1))
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  return (
    <Card className="group/card gap-0 border border-foreground/[0.07] bg-card p-5 shadow-card transition-colors hover:border-foreground/20">
      {/* 作者行 */}
      <div className="flex items-center gap-2.5">
        <Avatar name={doc.author?.display_name ?? "?"} id={doc.author?.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{doc.author?.display_name}</span>
            {doc.pinned && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-warning/10 px-1.5 py-0.5 text-[10px] font-medium text-warning">
                <Pin className="size-2.5" /> 置顶
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">{timeAgo(doc.created_at)}</span>
        </div>
        {isMine && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground"
            onClick={() => setEditOpen(true)}
            aria-label="编辑"
          >
            <Pencil />
          </Button>
        )}
      </div>

      {/* 内容 */}
      <Link to={`/documents/${doc.id}`} className="mt-4 block rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
        <h3 className="text-lg leading-snug font-semibold tracking-tight transition-colors group-hover/card:text-primary">
          {doc.title}
        </h3>
        {doc.content && (
          <RichContent
            content={doc.content}
            className="mt-2"
            textClassName="text-sm leading-6 text-muted-foreground"
            imageClassName="max-h-72"
            clampText
            imageLink={false}
          />
        )}
      </Link>

      <TagBadges tags={doc.tags} className="mt-4" />

      {/* 操作栏 */}
      <div className="mt-4 flex items-center gap-1.5 border-t pt-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          className={cn("gap-1.5", liked && "text-primary hover:text-primary/80")}
        >
          <ThumbsUp className={cn("size-4", liked && "fill-current")} />
          {count}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="size-4" />
          {commentCount}
        </Button>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link to={`/documents/${doc.id}`}>
            <BookOpenText />
            查看原文
          </Link>
        </Button>
      </div>

      <CommentsDialog
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        document={doc}
        onCountChange={(delta) => setCommentCount((c) => Math.max(0, c + delta))}
      />
      <DocumentEditorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        document={doc}
        folders={folders}
        onSaved={onChanged}
      />
    </Card>
  )
}
