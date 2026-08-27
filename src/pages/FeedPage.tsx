import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, PenSquare, RefreshCw } from "lucide-react"

import { DocumentCard } from "@/components/documents/DocumentCard"
import { DocumentEditorDialog } from "@/components/documents/DocumentEditorDialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { documentApi } from "@/lib/api"
import type { Document } from "@/lib/types"
import { cn } from "@/lib/utils"

type Sort = "latest" | "hot"
const PAGE_SIZE = 10

export function FeedPage() {
  const [sort, setSort] = useState<Sort>("latest")
  const [docs, setDocs] = useState<Document[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const mounted = useRef(true)

  const load = useCallback(
    async (targetSort: Sort, targetPage: number, append: boolean) => {
      if (targetPage > 1) setLoadingMore(true)
      else setLoading(true)
      try {
        const data = await documentApi.feed({ sort: targetSort, page: targetPage, page_size: PAGE_SIZE })
        if (!mounted.current) return
        setDocs((prev) => (append ? [...prev, ...data.documents] : data.documents))
        setTotal(data.pagination?.total ?? 0)
        setPage(targetPage)
      } finally {
        if (mounted.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    mounted.current = true
    void load(sort, 1, false)
    return () => {
      mounted.current = false
    }
  }, [sort, load])

  const hasMore = docs.length < total

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">信息流</h1>
          <p className="text-sm text-muted-foreground">课题组公开动态 · 科研朋友圈</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => load(sort, 1, false)}>
            <RefreshCw /> 刷新
          </Button>
          <Button size="sm" onClick={() => setEditorOpen(true)}>
            <PenSquare /> 发帖 / 写笔记
          </Button>
        </div>
      </div>

      {/* 排序切换 */}
      <div className="mb-4 inline-flex rounded-lg bg-muted p-1">
        {(
          [
            ["latest", "最新"],
            ["hot", "热门"],
          ] as [Sort, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setSort(value)}
            className={cn(
              "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
              sort === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-16 text-center">
          <p className="text-3xl">🧪</p>
          <p className="mt-2 text-sm text-muted-foreground">还没有公开帖子</p>
          <Button className="mt-4" variant="outline" onClick={() => setEditorOpen(true)}>
            发布第一篇帖子
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {docs.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onChanged={() => load(sort, 1, false)} />
          ))}
          {hasMore && (
            <div className="pt-2 text-center">
              <Button variant="outline" onClick={() => load(sort, page + 1, true)} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" />}
                加载更多
              </Button>
            </div>
          )}
          {!hasMore && docs.length > 0 && (
            <p className="pt-2 text-center text-xs text-muted-foreground">— 已经到底啦 —</p>
          )}
        </div>
      )}

      <DocumentEditorDialog open={editorOpen} onOpenChange={setEditorOpen} onSaved={() => load(sort, 1, false)} />
    </div>
  )
}
