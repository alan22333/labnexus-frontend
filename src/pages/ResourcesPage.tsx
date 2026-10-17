import { useCallback, useEffect, useRef, useState } from "react"
import {
  Download, ExternalLink, Eye, FileText, FolderKanban, ImageIcon, Link2, Loader2, Pencil, Pin, PinOff,
  Plus, RefreshCw, RotateCcw, Search, Star, Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { ResourceCreateDialog } from "@/components/resources/ResourceCreateDialog"
import { TagBadges } from "@/components/common/TagBadges"
import { Avatar } from "@/components/common/Avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { fetchBlob, resourceApi, tagApi } from "@/lib/api"
import { timeAgo, fmtSize } from "@/lib/format"
import type { Resource, ResourceCategory, ResourceSort, ResourceType, Tag } from "@/lib/types"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 12
const ALL = "__all__"
const UNCATEGORIZED = "__none__"

const SORT_LABEL: Record<ResourceSort, string> = {
  latest: "最新",
  oldest: "最早",
  title: "标题",
  size: "大小",
  useful: "最有用",
}

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
  const [categoryId, setCategoryId] = useState<string>(ALL)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [sort, setSort] = useState<ResourceSort>("latest")
  const [mine, setMine] = useState(false)
  const [favorited, setFavorited] = useState(false)
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [createOpen, setCreateOpen] = useState(false)
  const [createType, setCreateType] = useState<ResourceType>("link")
  const [editTarget, setEditTarget] = useState<Resource | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Resource | null>(null)
  const [previewTarget, setPreviewTarget] = useState<Resource | null>(null)
  const mounted = useRef(true)

  const load = useCallback(async (targetPage: number, append: boolean) => {
    if (targetPage > 1) setLoadingMore(true)
    else setLoading(true)
    try {
      const data = await resourceApi.list({
        type: type || undefined,
        keyword: query || undefined,
        category_id: categoryId === ALL || categoryId === UNCATEGORIZED ? undefined : categoryId,
        uncategorized: categoryId === UNCATEGORIZED ? true : undefined,
        tag_ids: tagIds.length ? tagIds.join(",") : undefined,
        mine: mine || undefined,
        favorited: favorited || undefined,
        pinned: pinnedOnly || undefined,
        sort,
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
  }, [type, query, categoryId, tagIds, sort, mine, favorited, pinnedOnly])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    void load(1, false)
  }, [load])

  useEffect(() => {
    resourceApi.categories().then((d) => setCategories(d.categories ?? [])).catch(() => setCategories([]))
    tagApi.list().then((d) => setTags((d.tags ?? []).slice(0, 24))).catch(() => setTags([]))
  }, [])

  const hasFilter = Boolean(type || query || categoryId !== ALL || tagIds.length || mine || favorited || pinnedOnly)

  function resetFilters() {
    setType("")
    setKeyword("")
    setQuery("")
    setCategoryId(ALL)
    setTagIds([])
    setSort("latest")
    setMine(false)
    setFavorited(false)
    setPinnedOnly(false)
  }

  function recordView(r: Resource) {
    void resourceApi.view(r.id).catch(() => {})
    setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, view_count: x.view_count + 1 } : x)))
  }

  const isSheet = (r: Resource) => {
    const ext = (r.original_name ?? "").toLowerCase()
    return r.preview?.type === "sheet" || ext.endsWith(".xlsx") || ext.endsWith(".xls")
  }
  const isMarkdown = (r: Resource) => {
    const ext = (r.original_name ?? "").toLowerCase()
    return ext.endsWith(".md") || ext.endsWith(".markdown")
  }

  async function openPreview(r: Resource) {
    if (!r.preview?.supported || !r.preview?.url) return
    recordView(r)
    if (isSheet(r) || isMarkdown(r)) {
      setPreviewTarget(r)
      return
    }
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
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, download_count: x.download_count + 1 } : x)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "下载失败")
    }
  }

  async function toggleFavorite(r: Resource) {
    try {
      if (r.favorited) {
        await resourceApi.unfavorite(r.id)
      } else {
        await resourceApi.favorite(r.id)
      }
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, favorited: !x.favorited } : x)))
      toast.success(r.favorited ? "已取消收藏" : "已加入我的收藏")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
    }
  }

  async function togglePin(r: Resource) {
    try {
      const { resource } = await resourceApi.update(r.id, { pinned: !r.pinned })
      setResources((prev) => prev.map((x) => (x.id === r.id ? { ...x, pinned: resource.pinned } : x)))
      toast.success(resource.pinned ? "已置顶" : "已取消置顶")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "操作失败")
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
          <h1 className="text-lg font-semibold tracking-tight">资源库</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">课题组共享库 · 链接与文件统一入库</p>
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

      {/* 筛选栏 */}
      <Card className="mb-5 space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={type || ALL} onValueChange={(v) => setType(v === ALL ? "" : (v as ResourceType))}>
            <SelectTrigger className="w-28 active:bg-muted">
              <SelectValue placeholder="全部类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部类型</SelectItem>
              <SelectItem value="link">
                <span className="flex items-center gap-2"><Link2 className="size-4 text-muted-foreground" />链接</span>
              </SelectItem>
              <SelectItem value="file">
                <span className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />文件</span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger className="w-32 active:bg-muted">
              <SelectValue placeholder="全部分类" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>全部分类</SelectItem>
              <SelectItem value={UNCATEGORIZED}>未分类</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative min-w-40 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setQuery(keyword.trim())}
              placeholder="搜索标题 / 描述 / 文件名 / 链接 / 标签…"
              className="h-8 pl-8"
            />
          </div>

          <Select value={sort} onValueChange={(v) => setSort(v as ResourceSort)}>
            <SelectTrigger className="w-28 active:bg-muted">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABEL) as ResourceSort[]).map((k) => (
                <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => setQuery(keyword.trim())}
            className="bg-primary text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/80"
          >
            <Search className="size-3.5" /> 筛选
          </Button>
          <Button variant="outline" size="sm" onClick={resetFilters} disabled={!hasFilter && sort === "latest"} className="active:bg-muted">
            <RotateCcw className="size-3.5" /> 重置
          </Button>
          <span className="ml-auto shrink-0 text-sm text-muted-foreground">共 {total} 项</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterToggle active={mine} onClick={() => setMine((v) => !v)}>我上传的</FilterToggle>
          <FilterToggle active={favorited} onClick={() => setFavorited((v) => !v)}>
            <Star className={cn("size-3.5", favorited && "fill-current")} /> 我的收藏
          </FilterToggle>
          <FilterToggle active={pinnedOnly} onClick={() => setPinnedOnly((v) => !v)}>
            <Pin className="size-3.5" /> 置顶
          </FilterToggle>

          {tags.length > 0 && (
            <>
              <span className="mx-1 h-5 w-px bg-border" aria-hidden />
              <span className="text-xs text-muted-foreground">标签:</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {tags.map((t) => {
                  const on = tagIds.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTagIds((prev) => (on ? prev.filter((x) => x !== t.id) : [...prev, t.id]))}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                      )}
                    >
                      #{t.name}
                    </button>
                  )
                })}
              </div>
              {tagIds.length > 1 && (
                <span className="text-xs text-muted-foreground">(需同时具备)</span>
              )}
            </>
          )}
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
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FolderKanban className="size-5" />
          </span>
          <p className="mt-3 text-sm text-muted-foreground">
            {hasFilter ? "没有符合条件的资源,试试放宽筛选" : "暂无资源,上传文件或收藏第一个链接吧"}
          </p>
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
                onToggleFavorite={() => void toggleFavorite(r)}
                onTogglePin={() => void togglePin(r)}
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

      <ResourcePreviewDialog resource={previewTarget} onClose={() => setPreviewTarget(null)} />

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

function FilterToggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className={cn("h-7 gap-1.5", !active && "active:bg-muted")}
    >
      {children}
    </Button>
  )
}

/** 图片资源携带登录令牌,需先取回二进制再转本地对象地址作为封面 */
function ResourceThumb({ src, alt }: { src: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    fetchBlob(src)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => active && setFailed(true))
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return (
      <div className="flex h-36 items-center justify-center bg-muted/40 text-muted-foreground">
        <ImageIcon className="size-6" />
      </div>
    )
  }
  if (!url) return <Skeleton className="h-36 w-full rounded-none" />

  return (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className="h-36 w-full bg-muted/30 object-cover"
    />
  )
}

function ResourceCard({
  resource: r, canManage, onPreview, onDownload, onToggleFavorite, onTogglePin, onEdit, onDelete,
}: {
  resource: Resource
  canManage: boolean
  onPreview: () => void
  onDownload: () => void
  onToggleFavorite: () => void
  onTogglePin: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const isLink = r.type === "link"
  const isImage = !isLink && r.preview?.type === "image" && Boolean(r.preview?.url)
  return (
    <Card className={cn(
      "flex flex-col gap-0 overflow-hidden p-0 transition-shadow hover:shadow-raised",
      r.pinned && "ring-1 ring-primary/40"
    )}>
      {isImage && (
        <button
          type="button"
          onClick={onPreview}
          className="block w-full cursor-pointer border-b outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label={`预览图片 ${r.title}`}
        >
          <ResourceThumb src={r.preview.url as string} alt={r.title} />
        </button>
      )}
      <div className="flex flex-1 flex-col p-4">
      <div className="flex items-start gap-3">
        <span className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          isLink ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
        )}>
          {isLink ? <Link2 className="size-5" /> : <FileText className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="line-clamp-1 text-sm font-semibold">{r.title}</h3>
            {r.pinned && <Badge variant="secondary" className="shrink-0 gap-1 px-1.5 py-0 text-[10px]"><Pin className="size-3" />置顶</Badge>}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            {r.category && <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{r.category.name}</span>}
            {isLink ? (
              <a href={r.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-xs text-primary hover:underline">
                {r.url}
              </a>
            ) : (
              <p className="truncate text-xs text-muted-foreground">
                {r.original_name} · {fmtSize(r.file_size)}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={r.favorited ? "取消收藏" : "收藏"}
          className={cn(
            "shrink-0 rounded-md p-1 transition-colors",
            r.favorited ? "text-amber-500 hover:bg-muted" : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Star className={cn("size-4", r.favorited && "fill-current")} />
        </button>
      </div>

      {r.description && (
        <p className="mt-2.5 line-clamp-2 text-xs leading-5 text-muted-foreground">{r.description}</p>
      )}

      <TagBadges tags={r.tags} className="mt-2.5 mb-3" />

      <div className="mt-auto flex items-center gap-1.5 border-t pt-2.5 text-xs text-muted-foreground">
        <Avatar name={r.uploader?.display_name ?? "?"} id={r.uploader?.id} className="size-5" />
        <span className="line-clamp-1">{r.uploader?.display_name}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2.5 tabular-nums">
          <span className="flex items-center gap-0.5" title="浏览次数"><Eye className="size-3.5" />{r.view_count}</span>
          <span className="flex items-center gap-0.5" title="下载次数"><Download className="size-3.5" />{r.download_count}</span>
          <span>{timeAgo(r.created_at)}</span>
        </span>
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
            <Button variant="ghost" size="icon-sm" aria-label={r.pinned ? "取消置顶" : "置顶"} onClick={onTogglePin} className="active:bg-muted">
              {r.pinned ? <PinOff /> : <Pin />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="编辑" onClick={onEdit} className="active:bg-muted">
              <Pencil />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-destructive active:bg-muted" aria-label="删除" onClick={onDelete}>
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      </div>
    </Card>
  )
}

/** MD 前端渲染(先转义再解析,避免注入);XLSX 用 xlsx 依赖解析首个工作表 */
function ResourcePreviewDialog({ resource, onClose }: { resource: Resource | null; onClose: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [markdownHtml, setMarkdownHtml] = useState("")
  const [rows, setRows] = useState<string[][]>([])

  const open = resource != null
  const ext = (resource?.original_name ?? "").toLowerCase()
  const isSheet = resource?.preview?.type === "sheet" || ext.endsWith(".xlsx") || ext.endsWith(".xls")
  const isMarkdown = ext.endsWith(".md") || ext.endsWith(".markdown")

  useEffect(() => {
    if (!resource || !resource.preview?.url) return
    let active = true
    setLoading(true)
    setError("")
    setMarkdownHtml("")
    setRows([])
    void (async () => {
      try {
        const blob = await fetchBlob(resource.preview.url as string)
        if (!active) return
        if (isSheet) {
          const XLSX = await import("xlsx")
          const buf = await blob.arrayBuffer()
          const wb = XLSX.read(buf, { type: "array" })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" })
          if (active) setRows(data.map((row) => row.map((cell) => String(cell ?? ""))))
        } else {
          const text = await blob.text()
          if (active) setMarkdownHtml(markdownToHtml(text))
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "预览失败")
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [resource, isSheet])

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="line-clamp-1 pr-6">{resource?.title}</DialogTitle>
          <DialogDescription>{isSheet ? "表格预览(首个工作表)" : isMarkdown ? "Markdown 预览" : "预览"}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[68vh] overflow-auto rounded-lg border bg-background p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="animate-spin" />
            </div>
          ) : error ? (
            <p className="py-10 text-center text-sm text-destructive">{error}</p>
          ) : isSheet ? (
            <table className="w-full border-collapse text-xs">
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={cn("border-b", i === 0 && "bg-muted/50 font-medium")}>
                    {row.map((cell, j) => (
                      <td key={j} className="max-w-64 truncate border-r px-2 py-1.5 last:border-r-0">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div
              className="text-sm leading-6 [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-xs [&_h1]:mb-2 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_img]:my-2 [&_img]:max-w-full [&_img]:rounded [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_p]:my-2 [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:bg-muted/50 [&_th]:px-2 [&_th]:py-1"
              dangerouslySetInnerHTML={{ __html: markdownHtml }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** 轻量 Markdown 渲染(标题/加粗/斜体/行内代码/围栏代码/列表/引用/链接/图片/表格/分隔线)。
 *  先整体转义再按行解析,输出为受控 HTML,配合 dangerouslySetInnerHTML 使用。 */
function markdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n")
  const out: string[] = []
  let inCode = false
  let codeBuf: string[] = []
  let list: "ul" | "ol" | null = null

  const closeList = () => {
    if (list) {
      out.push(`</${list}>`)
      list = null
    }
  }
  const inline = (text: string): string => {
    let s = escapeHtml(text)
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>")
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2" />')
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    s = s.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`)
        codeBuf = []
        inCode = false
      } else {
        closeList()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    if (!trimmed) {
      closeList()
      continue
    }

    // 表格:当前行含 |,且下一行是分隔行
    if (trimmed.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
      const parseRow = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const header = parseRow(line)
      closeList()
      out.push("<table><thead><tr>")
      header.forEach((c) => out.push(`<th>${inline(c)}</th>`))
      out.push("</tr></thead><tbody>")
      i += 2
      while (i < lines.length && lines[i].trim().includes("|")) {
        const cells = parseRow(lines[i])
        out.push("<tr>")
        cells.forEach((c) => out.push(`<td>${inline(c)}</td>`))
        out.push("</tr>")
        i++
      }
      i--
      out.push("</tbody></table>")
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      closeList()
      const level = heading[1].length
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      if (list !== "ul") {
        closeList()
        out.push("<ul>")
        list = "ul"
      }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ""))}</li>`)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      if (list !== "ol") {
        closeList()
        out.push("<ol>")
        list = "ol"
      }
      out.push(`<li>${inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`)
      continue
    }
    if (/^\s*>\s?/.test(line)) {
      closeList()
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ""))}</blockquote>`)
      continue
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeList()
      out.push("<hr />")
      continue
    }
    closeList()
    out.push(`<p>${inline(line)}</p>`)
  }
  if (inCode) out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`)
  closeList()
  return out.join("\n")
}
