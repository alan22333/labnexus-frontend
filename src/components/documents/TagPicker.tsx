import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Loader2, Plus, Settings2, X } from "lucide-react"
import { toast } from "sonner"

import { TagManagerDialog } from "@/components/tags/TagManagerDialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { tagApi } from "@/lib/api"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
}

/** 标签多选(纯文本 #标签),发帖/资源共用,支持就地新建与管理 */
export function TagPicker({ selected, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const data = await tagApi.list()
      setTags(data.tags ?? [])
    } catch {
      setTags([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  async function create() {
    // 中文输入法合成时 state 可能尚未同步,以输入框当前 DOM 值兜底
    const current = name.trim() || nameInputRef.current?.value.trim() || ""
    if (!current) {
      toast.error("请输入标签名称")
      return
    }
    setSaving(true)
    try {
      const { tag } = await tagApi.create({ name: current })
      setTags((prev) => (prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]))
      onChange([...selected, tag.id])
      toast.success(`已创建并选中「${tag.name}」`)
      setName("")
      setCreating(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="text-sm text-muted-foreground">标签加载中…</div>

  return (
    <div className="space-y-3">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const active = selected.includes(t.id)
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
                  active
                    ? "border-primary/25 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/20 hover:text-foreground"
                )}
              >
                {active && <Check className="size-3" />}
                #{t.name}
              </button>
            )
          })}
        </div>
      )}

      {creating ? (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-2">
          <Input
            ref={nameInputRef}
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void create()
              }
              if (e.key === "Escape") setCreating(false)
            }}
            placeholder="新标签名称,回车创建"
            className="h-8 flex-1 bg-background text-sm"
            maxLength={50}
          />
          <Button size="sm" className="h-8" onClick={create} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : <Plus />} 创建
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => setCreating(false)} aria-label="取消新建标签">
            <X />
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" /> 新建标签
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-muted-foreground"
            onClick={() => setManageOpen(true)}
          >
            <Settings2 className="size-3.5" /> 管理标签
          </Button>
          {tags.length === 0 && (
            <span className="text-xs text-muted-foreground">还没有标签,点「新建标签」即可创建</span>
          )}
        </div>
      )}

      <TagManagerDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        onTagsChanged={() => void load()}
      />
    </div>
  )
}
