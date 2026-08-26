import { useEffect, useState } from "react"
import { Check } from "lucide-react"
import { tagApi } from "@/lib/api"
import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

interface Props {
  selected: string[]
  onChange: (ids: string[]) => void
}

/** 标签多选(胶囊勾选,发帖/资源共用) */
export function TagPicker({ selected, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    tagApi
      .list()
      .then(({ tags }) => {
        if (!cancelled) setTags(tags)
      })
      .catch(() => {
        if (!cancelled) setTags([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  if (loading) return <div className="text-sm text-muted-foreground">标签加载中…</div>

  if (tags.length === 0) {
    return (
      <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
        暂无标签,可先到「标签」页创建
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((t) => {
        const active = selected.includes(t.id)
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => toggle(t.id)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              active
                ? "border-transparent text-white shadow-sm"
                : "border-border bg-background text-foreground hover:bg-muted"
            )}
            style={active ? { background: t.color || "#3b82f6" } : undefined}
          >
            {active && <Check className="size-3" />}
            {t.name}
          </button>
        )
      })}
    </div>
  )
}
