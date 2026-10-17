import { lazy, Suspense, useMemo, type ReactNode } from "react"

import { RemoteImage } from "@/components/documents/RemoteImage"
import { normalizeBareImageUrls, stripMarkdown } from "@/lib/markdown"
import { cn } from "@/lib/utils"

// 重渲染管线(react-markdown/KaTeX/语法高亮)按需加载:卡片摘要不需要它
const MarkdownBody = lazy(() =>
  import("@/components/documents/MarkdownBody").then((m) => ({ default: m.MarkdownBody }))
)

const IMG_MD = /!\[([^\]]*)\]\(\s*(\S+?)\s*\)/g

type Segment = { kind: "text"; value: string } | { kind: "image"; alt: string; src: string }

/** 卡片摘要:正文去标记成纯文本,图片单独成块 */
function splitSummary(content: string): Segment[] {
  const source = normalizeBareImageUrls(content)
  const raw: Segment[] = []
  let last = 0
  const re = new RegExp(IMG_MD.source, "g")
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    if (m.index > last) raw.push({ kind: "text", value: source.slice(last, m.index) })
    raw.push({ kind: "image", alt: m[1], src: m[2] })
    last = m.index + m[0].length
  }
  if (last < source.length) raw.push({ kind: "text", value: source.slice(last) })
  return raw.map((seg) => (seg.kind === "text" ? { kind: "text", value: stripMarkdown(seg.value) } : seg))
}

/** 摘要渲染:信息流卡片,不解析 Markdown 结构,只留纯文本与图片 */
function RichSummary({
  content,
  className,
  textClassName,
  imageClassName,
  imageLink,
}: {
  content: string
  className?: string
  textClassName?: string
  imageClassName?: string
  imageLink: boolean
}) {
  const segments = useMemo(() => splitSummary(content), [content])

  return (
    <div className={cn("space-y-3", className)}>
      {segments.map((seg, i) =>
        seg.kind === "image" ? (
          <RemoteImage key={i} src={seg.src} alt={seg.alt} className={imageClassName} link={imageLink} />
        ) : seg.value.trim() ? (
          <p key={i} className={cn("line-clamp-4 whitespace-pre-wrap", textClassName)}>
            {seg.value}
          </p>
        ) : null
      )}
    </div>
  )
}

interface Props {
  content: string
  className?: string
  textClassName?: string
  imageClassName?: string
  /** 卡片预览:只渲染去标记摘要(限 4 行)与图片 */
  clampText?: boolean
  /** 图片是否自带外链(嵌在可点击卡片里时置 false) */
  imageLink?: boolean
  emptyText?: ReactNode
}

/** 正文渲染:完整 Markdown(阅读态)或去标记摘要(卡片态) */
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

  return clampText ? (
    <RichSummary
      content={content}
      className={className}
      textClassName={textClassName}
      imageClassName={imageClassName}
      imageLink={imageLink}
    />
  ) : (
    <Suspense
      fallback={
        <div className={cn("markdown-body", className)} data-slot="markdown-loading">
          <p className="text-muted-foreground">正在加载正文…</p>
        </div>
      }
    >
      <MarkdownBody
        content={content}
        className={className}
        textClassName={textClassName}
        imageClassName={imageClassName}
        imageLink={imageLink}
      />
    </Suspense>
  )
}
