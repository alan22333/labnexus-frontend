import type { Tag } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * 标签组:统一以「#名称」纯文本呈现,不使用彩色胶囊。
 * 颜色字段仍保留在数据层(后端契约不变),仅在需要区分类型时使用。
 */
export function TagBadges({ tags, className }: { tags?: Tag[]; className?: string }) {
  if (!tags?.length) return null
  return (
    <div className={cn("flex flex-wrap gap-x-2.5 gap-y-1", className)}>
      {tags.map((t) => (
        <span key={t.id} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
          #{t.name}
        </span>
      ))}
    </div>
  )
}
