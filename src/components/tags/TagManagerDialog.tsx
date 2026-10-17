import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Hash, Link2, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { tagApi } from "@/lib/api"
import type { Document, Resource, Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 标签库发生变化(新建)时通知外层,便于写作面板同步 */
  onTagsChanged?: () => void
}

/** 标签管理:两栏面板 —— 左侧维护标签,右侧查看该标签下的文档与资源 */
export function TagManagerDialog({ open, onOpenChange, onTagsChanged }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [creating, setCreating] = useState(false)
  const [active, setActive] = useState<Tag | null>(null)
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
    if (!open) return
    setActive(null)
    setContents(null)
    setName("")
    void load()
  }, [open, load])

  async function create() {
    // 中文输入法合成时 state 可能尚未同步,以输入框当前 DOM 值兜底
    const current = name.trim() || nameInputRef.current?.value.trim() || ""
    if (!current) {
      toast.error("请输入标签名称")
      return
    }
    setCreating(true)
    try {
      await tagApi.create({ name: current })
      toast.success("标签已创建")
      setName("")
      await load()
      onTagsChanged?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    } finally {
      setCreating(false)
    }
  }

  async function openContents(tag: Tag) {
    setActive(tag)
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

  const docCount = contents?.documents.length ?? 0
  const resCount = contents?.resources.length ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground" /> 标签管理
          </DialogTitle>
          <DialogDescription>
            标签是写作时的可选项:在这里创建,回到编辑器勾选使用;点选标签可查看它关联的内容。
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-[22rem] gap-0 overflow-hidden rounded-xl border sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          {/* 左栏:标签库 */}
          <div className="flex min-w-0 flex-col border-b bg-muted/20 sm:border-r sm:border-b-0">
            <div className="flex items-center gap-2 border-b px-3 py-2.5">
              <Input
                ref={nameInputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) void create()
                }}
                placeholder="新建标签,回车保存"
                className="h-8 flex-1 bg-background"
                maxLength={50}
              />
              <Button size="icon-sm" onClick={create} disabled={creating} aria-label="创建标签">
                {creating ? <Loader2 className="animate-spin" /> : <Plus />}
              </Button>
            </div>

            <div className="flex items-center justify-between px-3 pt-3 pb-1">
              <span className="text-xs font-medium text-muted-foreground">全部标签（{tags.length}）</span>
              <Button variant="ghost" size="icon-xs" onClick={() => void load()} disabled={loading} aria-label="刷新">
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : tags.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">还没有标签，在上方创建一个吧</p>
              ) : (
                <ul className="space-y-0.5">
                  {tags.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => void openContents(t)}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors",
                          active?.id === t.id
                            ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                        )}
                      >
                        <Hash className="size-3.5 shrink-0 opacity-50" />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        {active?.id === t.id && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* 右栏:标签内容 */}
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b px-4 py-2.5">
              <span className="text-xs font-medium text-muted-foreground">
                {active ? `#${active.name} 关联内容` : "关联内容"}
              </span>
              {active && (
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {docCount + resCount} 条
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {!active ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 py-14 text-center">
                  <Hash className="size-5 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">在左侧选择一个标签，查看它关联的文档与资源</p>
                </div>
              ) : contentLoading ? (
                <div className="flex justify-center py-14">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : docCount + resCount === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-14 text-center">
                  <Trash2 className="size-4 text-muted-foreground/50" />
                  <p className="text-xs text-muted-foreground">这个标签还没有关联任何内容</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ContentGroup icon={<FileText className="size-3.5" />} title="文档" count={docCount}>
                    {contents!.documents.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
                        <Avatar name={d.author?.display_name ?? "?"} id={d.author?.id} className="size-5" />
                        <span className="min-w-0 flex-1 truncate text-sm">{d.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {d.visibility === "public" ? "公开" : "私有"}
                        </span>
                      </div>
                    ))}
                  </ContentGroup>

                  <ContentGroup icon={<Link2 className="size-3.5" />} title="资源" count={resCount}>
                    {contents!.resources.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5">
                        <span className="shrink-0 text-muted-foreground">{r.type === "link" ? <Link2 className="size-3.5" /> : <FileText className="size-3.5" />}</span>
                        <span className="min-w-0 flex-1 truncate text-sm">{r.title}</span>
                      </div>
                    ))}
                  </ContentGroup>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ContentGroup({
  icon, title, count, children,
}: { icon: React.ReactNode; title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
        <span className="tabular-nums">（{count}）</span>
      </div>
      {count === 0 ? (
        <p className="px-0.5 text-xs text-muted-foreground/70">无</p>
      ) : (
        <div className="space-y-1.5">{children}</div>
      )}
    </div>
  )
}
