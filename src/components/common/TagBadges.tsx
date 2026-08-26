import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

/** 标签胶囊组 */
export function TagBadges({ tags, className }: { tags?: Tag[]; className?: string }) {
  if (!tags?.length) return null
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
          style={{ background: t.color || "#3b82f6" }}
        >
          {t.name}
        </span>
      ))}
    </div>
  )
}
