import { useState } from "react"
import { MessageCircle, Pencil, Pin, ThumbsUp } from "lucide-react"
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
import { DocumentDetailDialog } from "./DocumentDetailDialog"
import { DocumentEditorDialog } from "./DocumentEditorDialog"

// 会话内点赞记录(用于按钮高亮)
const sessionLiked = new Set<string>()

interface Props {
  doc: Document
  folders?: Folder[]
  onChanged?: () => void
  detailOnClick?: boolean
}

/** 信息流帖子卡片 */
export function DocumentCard({ doc, folders, onChanged, detailOnClick }: Props) {
  const { user } = useAuth()
  const [count, setCount] = useState(doc.reactions_count ?? 0)
  const [liked, setLiked] = useState(sessionLiked.has(doc.id))
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const isMine = user != null && doc.author_id === user.id

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

  function openDetail() {
    setDetailId(doc.id)
    setDetailOpen(true)
  }

  return (
    <Card className="p-4 transition-shadow hover:shadow-md sm:p-5">
      {/* 作者行 */}
      <div className="flex items-center gap-2.5">
        <Avatar name={doc.author?.display_name ?? "?"} id={doc.author?.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{doc.author?.display_name}</span>
            {doc.pinned && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
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
      <button
        type="button"
        onClick={detailOnClick ? openDetail : undefined}
        className="mt-3 block w-full text-left"
      >
        <h3 className="text-base leading-snug font-semibold tracking-tight">{doc.title}</h3>
        {doc.content && (
          <p className="mt-1.5 line-clamp-4 text-sm leading-6 text-muted-foreground whitespace-pre-wrap">
            {doc.content}
          </p>
        )}
      </button>

      <TagBadges tags={doc.tags} className="mt-3" />

      {/* 操作栏 */}
      <div className="mt-3 flex items-center gap-1.5 border-t pt-3">
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
          {doc.comments_count ?? 0}
        </Button>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={openDetail}>
            查看
          </Button>
        </div>
      </div>

      <CommentsDialog open={commentsOpen} onOpenChange={setCommentsOpen} document={doc} />
      <DocumentDetailDialog
        documentId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onOpenComments={() => {
          setDetailOpen(false)
          setCommentsOpen(true)
        }}
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

