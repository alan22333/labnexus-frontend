import { useEffect, useState } from "react"
import { Eye, Loader2, MessageCircle, ThumbsUp } from "lucide-react"

import { Avatar } from "@/components/common/Avatar"
import { TagBadges } from "@/components/common/TagBadges"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { documentApi } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { Document } from "@/lib/types"

interface Props {
  documentId: string | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onOpenComments?: (doc: Document) => void
}

/** 文档详情:完整正文 + 元信息 */
export function DocumentDetailDialog({ documentId, open, onOpenChange, onOpenComments }: Props) {
  const [doc, setDoc] = useState<Document | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !documentId) return
    setLoading(true)
    documentApi
      .get(documentId)
      .then(setDoc)
      .catch(() => setDoc(null))
      .finally(() => setLoading(false))
  }, [open, documentId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {loading || !doc ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg leading-snug">{doc.title}</DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
                <span className="inline-flex items-center gap-1.5">
                  <Avatar name={doc.author?.display_name ?? "?"} id={doc.author?.id} className="size-5" />
                  {doc.author?.display_name}
                </span>
                <span>{formatDateTime(doc.created_at)}</span>
                <span>{doc.visibility === "public" ? "公开" : "私有"}</span>
              </DialogDescription>
            </DialogHeader>
            <TagBadges tags={doc.tags} />
            <div className="max-h-[50vh] overflow-y-auto rounded-xl bg-muted/40 p-4 text-sm leading-7 whitespace-pre-wrap">
              {doc.content || <span className="text-muted-foreground">(无正文)</span>}
            </div>
            <div className="flex items-center gap-2 border-t pt-3">
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <ThumbsUp className="size-4" /> {doc.reactions_count ?? 0}
              </span>
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MessageCircle className="size-4" /> {doc.comments_count ?? 0}
              </span>
              <div className="ml-auto flex gap-2">
                {onOpenComments && (
                  <Button variant="outline" onClick={() => onOpenComments(doc)}>
                    <Eye /> 查看评论
                  </Button>
                )}
                <Button variant="outline" onClick={() => onOpenChange(false)}>关闭</Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
