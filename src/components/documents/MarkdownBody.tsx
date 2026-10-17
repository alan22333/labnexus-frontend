import { useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import rehypeKatex from "rehype-katex"
import rehypeSanitize from "rehype-sanitize"
import remarkBreaks from "remark-breaks"
import remarkGfm from "remark-gfm"
import remarkMath from "remark-math"

import "katex/dist/katex.min.css"

import { RemoteImage } from "@/components/documents/RemoteImage"
import { normalizeBareImageUrls } from "@/lib/markdown"
import { cn } from "@/lib/utils"

const REMARK_PLUGINS = [remarkGfm, remarkBreaks, remarkMath]
// 顺序关键:先用 sanitize 清洗用户输入,再注入公式与代码高亮(后两者产物可信)
const REHYPE_PLUGINS = [rehypeSanitize, rehypeKatex, rehypeHighlight]

function buildComponents(imageClassName?: string, imageLink = true): Components {
  return {
    img: ({ src, alt }) => (
      <RemoteImage src={typeof src === "string" ? src : ""} alt={alt ?? ""} className={imageClassName} link={imageLink} />
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
      >
        {children}
      </a>
    ),
    table: ({ children }) => (
      <div className="markdown-table-wrap">
        <table>{children}</table>
      </div>
    ),
    pre: ({ children }) => <pre className="markdown-pre">{children}</pre>,
  }
}

/**
 * 完整 Markdown 渲染(阅读态/详情弹窗/编辑器预览)。
 * 依赖较重(公式与语法高亮),由 RichContent 动态加载,信息流卡片不必为此付出体积。
 */
export function MarkdownBody({
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
  const normalized = useMemo(() => normalizeBareImageUrls(content), [content])
  const components = useMemo(() => buildComponents(imageClassName, imageLink), [imageClassName, imageLink])

  return (
    <div className={cn("markdown-body", textClassName, className)}>
      <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={components}>
        {normalized}
      </ReactMarkdown>
    </div>
  )
}
