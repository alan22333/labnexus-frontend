import { useEffect, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, BookOpenText, Eye, Loader2, MessageCircle, ThumbsUp } from "lucide-react"

import { Avatar } from "@/components/common/Avatar"
import { TagBadges } from "@/components/common/TagBadges"
import { CommentsDialog } from "@/components/documents/CommentsDialog"
import { RichContent } from "@/components/documents/RichContent"
import { Button } from "@/components/ui/button"
import { documentApi } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { Document } from "@/lib/types"

/** 文档阅读页:以正文展示为主,操作保持克制 */
export function DocumentReaderPage() {
  const { id } = useParams()
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(true)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [commentCount, setCommentCount] = useState(0)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    documentApi
      .get(id)
      .then((data) => {
        if (!active) return
        setDoc(data)
        setCommentCount(data.comments_count ?? 0)
        window.scrollTo({ top: 0, behavior: "smooth" })
      })
      .catch(() => {
        if (active) setDoc(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-10 text-center shadow-sm">
        <p className="text-lg font-semibold">无法打开这篇内容</p>
        <p className="mt-2 text-sm text-muted-foreground">内容可能已被删除,或你没有查看权限。</p>
        <Button variant="outline" className="mt-5" asChild>
          <Link to="/">
            <ArrowLeft />
            返回信息流
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground" asChild>
        <Link to="/">
          <ArrowLeft />
          返回信息流
        </Link>
      </Button>

      <article className="overflow-hidden border border-foreground/[0.07] bg-card shadow-card">
        <header className="border-b px-6 py-7 sm:px-10 sm:py-9">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <BookOpenText className="size-3.5" />
            阅读模式
          </div>
          <h1 className="text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            {doc.title}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <Avatar name={doc.author?.display_name ?? "?"} id={doc.author?.id} className="size-6" />
              <span className="font-medium text-foreground">{doc.author?.display_name}</span>
            </span>
            <span>{formatDateTime(doc.created_at)}</span>
            <span>{doc.visibility === "public" ? "公开" : "私有"}</span>
          </div>
        </header>

        <div className="px-6 py-8 sm:px-10 sm:py-10">
          <TagBadges tags={doc.tags} />
          <RichContent
            content={doc.content}
            className="mt-7"
            textClassName="text-[15px] leading-8 text-foreground/90 sm:text-base"
            emptyText="(无正文)"
          />
        </div>

        <footer className="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4 sm:px-10">
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <ThumbsUp className="size-4" /> {doc.reactions_count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Eye className="size-4" /> 只读展示
          </span>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setCommentsOpen(true)}>
            <MessageCircle />
            评论 {commentCount}
          </Button>
        </footer>
      </article>

      <CommentsDialog
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        document={doc}
        onCountChange={(delta) => setCommentCount((count) => Math.max(0, count + delta))}
      />
    </div>
  )
}
