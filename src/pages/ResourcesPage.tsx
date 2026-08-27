import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download, ExternalLink, FileText, Eye, Link2, Loader2, Pencil, Plus, RefreshCw, RotateCcw, Search, Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { ResourceCreateDialog } from "@/components/resources/ResourceCreateDialog"
import { TagBadges } from "@/components/common/TagBadges"
import { Avatar } from "@/components/common/Avatar"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchBlob, resourceApi } from "@/lib/api"
import { timeAgo, fmtSize } from "@/lib/format"
import type { Resource, ResourceType } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 12

export function ResourcesPage() {
  const { user } = useAuth()
  const [resources, setResources] = useState<Resource[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const [type, setType] = useState<ResourceType | "">("")
  const [keyword, setKeyword] = useState("")
  const [query, setQuery] = useState("")

  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<ResourceType>("link")
  const [editTarget, setEditTarget] = useState<Resource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (targetPage > 1) setLoadingMore(true)
    else setLoading(true)
    try {
      const data = await resourceApi.list({
        type: type || undefined,
        keyword: query || undefined,
        page: targetPage,
        page_size: PAGE_SIZE,
      })
      if (!mounted.current) return
      setResources((prev) => (append ? [...prev, ...data.resources] : data.resources))
      setTotal(data.pagination?.total ?? 0)
      setPage(targetPage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败")
    } finally {
      if (mounted.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [type, query])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    void load(1, false)
  }, [load])

  async function openPreview(r: Resource) {
    if (!r.preview?.supported || !r.preview?.url) return
    try {
      const blob = await fetchBlob(r.preview.url)
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "预览失败")
    }
  }

  async function download(r: Resource) {
    if (!r.download_url) return
    try {
      const blob = await fetchBlob(r.download_url)
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = r.original_name || r.title
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下载失败")
    }
  }

  async function remove() {
    if (!deleteTarget) return
    try {
      await resourceApi.remove(deleteTarget.id)
      toast.success("资源已删除")
      setDeleteTarget(null)
      await load(1, false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
      setDeleteTarget(null)
    }
  }

  const hasMore = resources.length < total

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">资源库</h1>
          <p className="text-sm text-muted-foreground">课题组共享库 · 链接与文件统一入库</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load(1, false)} className="active:bg-muted">
            <RefreshCw /> 刷新
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setCreateType("link"); setEditTarget(null); setCreateOpen(true) }} className="active:bg-muted">
            <Link2 /> 新建链接
          </Button>
          <Button size="sm" onClick={() => { setCreateType("file"); setEditTarget(null); setCreateOpen(true) }} className="active:bg-primary/90">
            <Plus /> 上传文件
          </Button>
        </div>
      </div>

      {/* 筛选栏:单行布局,按钮成组,点击带背景反馈 */}
      <Card className="mb-5 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(v as ResourceType | "")}>
            <SelectTrigger className="w-28 active:bg-muted">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部类型</SelectItem>
              <SelectItem value="link">🔗 链接</SelectItem>
              <SelectItem value="file">📎 文件</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(keyword.trim())}
              placeholder="按标题关键词筛选…"
              className="h-8 pl-8"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              onClick={() => { setQuery(keyword.trim()) }}
              className="bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/80"
            >
              <Search className="size-3.5" /> 筛选
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setType(""); setKeyword(""); setQuery("") }}
              className="active:bg-muted"
            >
              <RotateCcw className="size-3.5" /> 重置
            </Button>
          </div>
          <span className="ml-auto shrink-0 text-sm text-muted-foreground">共 {total} 项</span>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : resources.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-20 text-center">
          <p className="text-3xl">📚</p>
          <p className="mt-2 text-sm text-muted-foreground">暂无资源,上传文件或收藏第一个链接吧</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {resources.map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                canManage={user != null && (r.uploader_id === user.id || user.role === "admin")}
                onPreview={() => void openPreview(r)}
                onDownload={() => void download(r)}
                onEdit={() => { setEditTarget(r); setCreateOpen(true) }}
                onDelete={() => setDeleteTarget(r)}
              />
            ))}
          </div>
          <div className="mt-6 text-center">
            {hasMore ? (
              <Button variant="outline" onClick={() => void load(page + 1, true)} disabled={loadingMore}>
                {loadingMore && <Loader2 className="animate-spin" />}
                加载更多
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">— 已经到底啦 —</p>
            )}
          </div>
        </>
      )}

      <ResourceCreateDialog
        open={createOpen}
        onOpenChange={(v) => {
          setCreateOpen(v)
          if (!v) setEditTarget(null)
        }}
        initialType={createType}
        resource={editTarget}
        onSaved={() => void load(1, false)}
      />

      <AlertDialog open={deleteTarget != null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除资源「{deleteTarget?.title}」?</AlertDialogTitle>
            <AlertDialogDescription>删除为永久操作,文件将同时从服务器移除,不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ResourceCard({
  resource: r, canManage, onPreview, onDownload, onEdit, onDelete,
}: {
  resource: Resource
  canManage: boolean
  onPreview: () => void
  onDownload: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isLink = r.type === "link"
  return (
    <Card className="flex flex-col p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        <span className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          isLink ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"
        )}>
          {isLink ? <Link2 className="size-5" /> : <FileText className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-1 text-sm font-semibold">{r.title}</h3>
          {isLink ? (
            <a href={r.url} target="_blank" rel="noreferrer" className="mt-0.5 line-clamp-1 text-xs text-primary hover:underline">
              {r.url}
            </a>
          ) : (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {r.original_name} · {fmtSize(r.file_size)}
            </p>
          )}
        </div>
      </div>

      {r.description && (
        <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{r.description}</p>
      )}

      <TagBadges tags={r.tags} className="mt-2.5" />

      <div className="mt-3 flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
        <Avatar name={r.uploader?.display_name ?? "?"} id={r.uploader?.id} className="size-5" />
        <span className="line-clamp-1">{r.uploader?.display_name}</span>
        <span className="ml-auto shrink-0">{timeAgo(r.created_at)}</span>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {isLink ? (
          <Button variant="outline" size="sm" asChild>
            <a href={r.url} target="_blank" rel="noreferrer">
              <ExternalLink /> 打开
            </a>
          </Button>
        ) : (
          <>
            {r.preview?.supported && (
              <Button variant="outline" size="sm" onClick={onPreview} className="active:bg-muted">
                <Eye /> 预览
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={onDownload} className="active:bg-muted">
              <Download /> 下载
            </Button>
          </>
        )}
        {canManage && (
          <div className="ml-auto flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="编辑" onClick={onEdit} className="active:bg-muted">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive active:bg-muted" aria-label="删除" onClick={onDelete}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}


