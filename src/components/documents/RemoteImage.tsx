import { useEffect, useState } from "react"
import { ImageOff, Loader2 } from "lucide-react"

import { fetchBlob } from "@/lib/api"
import { cn } from "@/lib/utils"

/** 资源库图片需要携带登录令牌,先取回二进制再转成本地对象地址;外链图片直接呈现 */
export function RemoteImage({
  src,
  alt,
  className,
  link,
}: {
  src: string
  alt: string
  className?: string
  link: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)

    if (!src) {
      setFailed(true)
      return
    }
    if (/^https?:\/\//i.test(src)) {
      setUrl(src)
      return
    }
    fetchBlob(src)
      .then((blob) => {
        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch(() => {
        if (active) setFailed(true)
      })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (failed) {
    return (
      <span
        className={cn(
          "flex items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground",
          className
        )}
      >
        <ImageOff className="size-4" />
        图片加载失败{alt ? `:${alt}` : ""}
      </span>
    )
  }

  if (!url) {
    return (
      <span className={cn("flex h-40 items-center justify-center rounded-xl border bg-muted/40", className)}>
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </span>
    )
  }

  const img = (
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={cn(
        "mx-auto max-h-[28rem] w-auto max-w-full rounded-xl border bg-muted/20 object-contain",
        className
      )}
    />
  )

  if (!link) return img

  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      {img}
    </a>
  )
}
