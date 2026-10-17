/**
 * Markdown 文本工具(纯函数,便于单测)。
 * 见后端 docs/specs/f3-document.md §2.1「内容格式:Markdown 渲染与编辑」。
 */

const CODE_FENCE = /```[^\n]*\n([\s\S]*?)```/g
// 整行即为图片地址:外链图片文件,或资源库预览地址(需带令牌取回)
const BARE_IMAGE_URL =
  /^(?:https?:\/\/\S+\.(?:png|jpe?g|gif|webp|bmp|svg|avif)(?:\?\S*)?|\/api\/resources\/[\w-]+\/preview(?:\?\S*)?)$/i

/** 把只有一行图片地址的段落转成 Markdown 图片,便于统一渲染 */
export function normalizeBareImageUrls(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      const trimmed = line.trim()
      return trimmed && BARE_IMAGE_URL.test(trimmed) ? `![](${trimmed})` : line
    })
    .join("\n")
}

/**
 * 去掉 Markdown 标记,得到用于摘要/搜索展示的纯文本。
 * 围栏代码块内容保留(先摘出,避免被去标记规则误伤)。
 */
export function stripMarkdown(md: string): string {
  if (!md) return ""
  const codes: string[] = []
  let s = md.replace(/\r\n?/g, "\n")

  // 1) 先摘出围栏代码块
  s = s.replace(CODE_FENCE, (_m, code: string) => {
    codes.push(String(code).replace(/\s+$/, ""))
    return `\u0000${codes.length - 1}\u0000`
  })

  // 2) 图片整体移除;链接保留可见文字
  s = s.replace(/!\[[^\]]*\]\([^)]*\)/g, "")
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")

  // 3) 表格:先删分隔行,再把竖线换成空格
  s = s.replace(/^[ \t]*\|?[ \t:|-]*---[ \t:|-]*\|?[ \t]*$/gm, "")
  s = s.replace(/^[ \t]*\|(.+)\|[ \t]*$/gm, (_m, inner: string) =>
    String(inner)
      .split("|")
      .map((cell) => cell.trim())
      .filter(Boolean)
      .join(" ")
  )

  // 4) 行首块级标记:标题 / 引用 / 列表 / 分隔线
  s = s.replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
  s = s.replace(/^[ \t]{0,3}>[ \t]?/gm, "")
  s = s.replace(/^[ \t]{0,3}[-*+][ \t]+/gm, "")
  s = s.replace(/^[ \t]{0,3}\d+[.)][ \t]+/gm, "")
  s = s.replace(/^[ \t]*([-*_])(?:[ \t]*\1){2,}[ \t]*$/gm, "")

  // 5) 强调 / 行内代码 / 删除线
  s = s.replace(/(\*\*|__)([\s\S]*?)\1/g, "$2")
  s = s.replace(/\*([^*\n]+)\*/g, "$1")
  s = s.replace(/__([^_\n]+)__/g, "$1")
  s = s.replace(/`([^`\n]*)`/g, "$1")
  s = s.replace(/~~([\s\S]*?)~~/g, "$1")

  // 6) HTML 标签
  s = s.replace(/<\/?[a-zA-Z][^>]*>/g, "")

  // 7) 还原代码块
  s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => codes[Number(i)] ?? "")

  // 8) 收尾:去行尾空白、折叠多余空格与空行
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, "").replace(/[ \t]{2,}/g, " "))
    .join("\n")
  return s.replace(/\n{3,}/g, "\n\n").trim()
}
