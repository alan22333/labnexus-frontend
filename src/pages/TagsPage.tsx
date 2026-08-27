import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Plus, RefreshCw, Tag as TagIcon } from "lucide-react"
import { toast } from "sonner"

import { TagBadges } from "@/components/common/TagBadges"
import { Avatar } from "@/components/common/Avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { tagApi } from "@/lib/api"
import type { Document, Resource, Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

const COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#64748b",
]

export function TagsPage() {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [color, setColor] = useState(COLORS[0])
  const [creating, setCreating] = useState(false)
  const [contentTag, setContentTag] = useState<Tag | null>(null)
  const [contents, setContents] = useState<{ documents: Document[]; resources: Resource[] } | null>(null)
  const [contentLoading, setContentLoading] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await tagApi.list()
      setTags(data.tags ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "标签加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    // 中文输入法合成时 state 可能尚未同步,以输入框当前 DOM 值兜底
    const current = name.trim() || nameInputRef.current?.value.trim() || ""
    if (!current) {
      toast.error("请输入标签名称")
      return
    }
    setCreating(true)
    try {
      await tagApi.create({ name: current, color })
      toast.success("标签已创建")
      setName("")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    } finally {
      setCreating(false)
    }
  }

  async function openContents(tag: Tag) {
    setContentTag(tag)
    setContents(null)
    setContentLoading(true)
    try {
      const data = await tagApi.contents(tag.id)
      setContents(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "加载失败")
    } finally {
      setContentLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">标签</h1>
          <p className="text-sm text-muted-foreground">全局标签库 · 跨文档与资源检索</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw /> 刷新
          </Button>
        </div>
      </div>

      {/* 创建标签 */}
      <Card className="mb-5 p-4 sm:p-5">
        <h2 className="mb-4 text-sm font-semibold">创建新标签</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:max-w-xs">
            <Label htmlFor="tag-name" className="text-sm font-medium">标签名称</Label>
            <Input
              id="tag-name"
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) void create()
              }}
              placeholder="输入中文标签名,如:组会纪要"
              className="h-10 w-full"
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">颜色</Label>
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-6 rounded-full ring-2 ring-offset-2 transition-transform hover:scale-110",
                    color === c ? "ring-foreground/40" : "ring-transparent"
                  )}
                  style={{ background: c }}
                  aria-label={`颜色 ${c}`}
                />
              ))}
            </div>
          </div>
          <Button onClick={create} disabled={creating} className="h-10">
            {creating ? <Loader2 className="animate-spin" /> : <Plus />}
            创建标签
          </Button>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : tags.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-20 text-center">
          <p className="text-3xl">🏷️</p>
          <p className="mt-2 text-sm text-muted-foreground">暂无标签,创建一个吧</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {tags.map((t) => (
            <button key={t.id} type="button" onClick={() => void openContents(t)} className="text-left">
              <Card className="h-full p-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                <span
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-white"
                  style={{ background: t.color || "#3b82f6" }}
                >
                  <TagIcon className="size-3.5 shrink-0" />
                  <span className="truncate">{t.name}</span>
                </span>
                <p className="mt-3 text-xs text-muted-foreground">点击查看内容</p>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* 标签内容 */}
      <Dialog open={contentTag != null} onOpenChange={(v) => !v && setContentTag(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <span
                className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium text-white"
                style={{ background: contentTag?.color || "#3b82f6" }}
              >
                {contentTag?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 space-y-5 overflow-y-auto">
            {contentLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">文档 ({contents?.documents.length ?? 0})</h4>
                  {(contents?.documents.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">无</p>
                  ) : (
                    <div className="space-y-1.5">
                      {contents!.documents.map((d) => (
                        <div key={d.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                          <Avatar name={d.author?.display_name ?? "?"} id={d.author?.id} className="size-5" />
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{d.title}</span>
                          <span className="text-xs text-muted-foreground">{d.visibility === "public" ? "公开" : "私有"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <h4 className="mb-2 text-sm font-semibold">资源 ({contents?.resources.length ?? 0})</h4>
                  {(contents?.resources.length ?? 0) === 0 ? (
                    <p className="text-sm text-muted-foreground">无</p>
                  ) : (
                    <div className="space-y-1.5">
                      {contents!.resources.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                          <span className="text-sm">{r.type === "link" ? "🔗" : "📎"}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{r.title}</span>
                          <TagBadges tags={r.tags} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}



