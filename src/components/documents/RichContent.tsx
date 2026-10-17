import { useEffect, useState, type ReactNode } from "react"
import { ImageOff, Loader2 } from "lucide-react"

import { fetchBlob } from "@/lib/api"
import { cn } from "@/lib/utils"

// Markdown 图片:![alt](src)
const IMG_MD = /!\[([^\]]*)\]\(\s*(\S+?)\s*\)/g
// 裸图片地址:外链图片文件,或资源库预览地址
const IMG_URL =
  /^(?:https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg|avif)(?:\?\S*)?|\/api\/resources\/[\w-]+\/preview(?:\?\S*)?)$/i

type Segment =
  | { kind: "text"; value: string }
  | { kind: "image"; alt: string; src: string }

/** 把正文拆成「文本 / 图片」片段 */
function parseContent(content: string): Segment[] {
  const raw: Segment[] = []
  let last = 0
  const re = new RegExp(IMG_MD.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) raw.push({ kind: "text", value: content.slice(last, m.index) })
    raw.push({ kind: "image", alt: m[1], src: m[2] })
    last = m.index + m[0].length
  }
  if (last < content.length) raw.push({ kind: "text", value: content.slice(last) })

  // 文本片段再按行识别裸图片地址
  const out: Segment[] = []
  for (const seg of raw) {
    if (seg.kind === "image") {
      out.push(seg)
      continue
    }
    const lines = seg.value.split("\n")
    lines.forEach((line, i) => {
      const trimmed = line.trim()
      const tail = i < lines.length - 1 ? "\n" : ""
      if (trimmed && IMG_URL.test(trimmed)) out.push({ kind: "image", alt: "", src: trimmed })
      else out.push({ kind: "text", value: line + tail })
    })
  }
  return out
}

/** 资源库图片需要携带登录令牌,先取回二进制再转成本地对象地址 */
function RemoteImage({ src, alt, className, link }: { src: string; alt: string; className?: string; link: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    let objectUrl: string | null = null
    setUrl(null)
    setFailed(false)

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
      <span className={cn("flex items-center gap-2 rounded-xl border border-dashed bg-muted/40 px-3 py-2 text-xs text-muted-foreground", className)}>
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

interface Props {
  content: string
  className?: string
  textClassName?: string
  imageClassName?: string
  /** 卡片预览时限制文本行数 */
  clampText?: boolean
  /** 图片是否自带外链(嵌在可点击卡片里时置 false) */
  imageLink?: boolean
  emptyText?: ReactNode
}

/** 正文渲染:纯文本原样保留换行,图片按块展示 */
export function RichContent({
  content,
  className,
  textClassName,
  imageClassName,
  clampText = false,
  imageLink = true,
  emptyText,
}: Props) {
  if (!content?.trim()) {
    return emptyText ? <span className="text-muted-foreground">{emptyText}</span> : null
  }

  const segments = parseContent(content)

  return (
    <div className={cn("space-y-3", className)}>
      {segments.map((seg, i) =>
        seg.kind === "image" ? (
          <RemoteImage key={i} src={seg.src} alt={seg.alt} className={imageClassName} link={imageLink} />
        ) : seg.value.trim() ? (
          <p
            key={i}
            className={cn(
              "whitespace-pre-wrap",
              clampText && "line-clamp-4",
              textClassName
            )}
          >
            {seg.value.replace(/^\n+|\n+$/g, "")}
          </p>
        ) : null
      )}
    </div>
  )
}
