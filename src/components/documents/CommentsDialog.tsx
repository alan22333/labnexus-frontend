import { useCallback, useEffect, useState } from "react"
import { Loader2, MessageCircle, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/hooks/use-auth"
import { documentApi } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import type { Comment, Document } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  document: Document | null
  onCountChange?: (delta: number) => void
}

/** 评论对话框:列表 + 发表 + 删除自己的评论 */
export function CommentsDialog({ open, onOpenChange, document, onCountChange }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(false)
  const [content, setContent] = useState("")
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!document) return
    setLoading(true)
    try {
      const data = await documentApi.comments(document.id)
      setComments(data.comments ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评论加载失败")
    } finally {
      setLoading(false)
    }
  }, [document])

  useEffect(() => {
    if (open && document) {
      setContent("")
      void load()
    }
  }, [open, document, load])

  async function send() {
    if (!document || !content.trim()) return
    setSending(true)
    try {
      await documentApi.addComment(document.id, { content: content.trim() })
      setContent("")
      await load()
      onCountChange?.(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "评论失败")
    } finally {
      setSending(false)
    }
  }

  async function remove(c: Comment) {
    try {
      await documentApi.deleteComment(c.id)
      await load()
      onCountChange?.(-1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-primary" />
            评论
          </DialogTitle>
          <DialogDescription className="line-clamp-1">{document?.title}</DialogDescription>
        </DialogHeader>

        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : comments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">还没有评论,来说两句吧</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <Avatar name={c.author?.display_name ?? "?"} id={c.author?.id} className="size-8" />
                <div className="min-w-0 flex-1 rounded-xl bg-muted/50 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{c.author?.display_name}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.content}</p>
                </div>
                {user && c.author_id === user.id && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="self-center text-muted-foreground hover:text-destructive"
                    onClick={() => remove(c)}
                    aria-label="删除评论"
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2 border-t pt-3">
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="写下你的评论…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <Button onClick={send} disabled={sending || !content.trim()}>
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
            发送
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
