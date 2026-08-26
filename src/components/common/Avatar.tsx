import { Avatar as AvatarPrimitive, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { avatarHue, initials } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Props {
  name: string
  id?: string
  src?: string | null
  className?: string
}

/** 基于用户 id 生成稳定底色的头像 */
export function Avatar({ name, id = "", src, className }: Props) {
  const hue = avatarHue(id || name)
  return (
    <AvatarPrimitive className={cn("size-8 shrink-0", className)}>
      {src ? <AvatarImage src={src} alt={name} /> : null}
      <AvatarFallback
        className="text-xs font-semibold text-white"
        style={{ background: `hsl(${hue} 65% 55%)` }}
      >
        {initials(name)}
      </AvatarFallback>
    </AvatarPrimitive>
  )
}
