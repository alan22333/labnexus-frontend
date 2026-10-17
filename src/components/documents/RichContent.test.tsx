import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { RichContent } from "@/components/documents/RichContent"

vi.mock("@/lib/api", () => ({
  fetchBlob: vi.fn(() => Promise.resolve(new Blob(["x"], { type: "image/png" }))),
}))

async function renderHTML(content: string) {
  const { container } = render(<RichContent content={content} />)
  // 完整渲染管线按需加载,等正文挂载后再断言
  await waitFor(() =>
    expect(container.querySelector(".markdown-body:not([data-slot='markdown-loading'])")).not.toBeNull()
  )
  return container
}

describe("RichContent Markdown 渲染", () => {
  it("标题/粗体/列表/引用/行内代码按结构渲染", async () => {
    const c = await renderHTML("# 大标题\n\n**粗体**\n\n- 甲\n- 乙\n\n> 引用\n\n`code`")
    expect(c.querySelector("h1")?.textContent).toBe("大标题")
    expect(c.querySelector("strong")?.textContent).toBe("粗体")
    expect(c.querySelectorAll("li")).toHaveLength(2)
    expect(c.querySelector("blockquote")?.textContent).toContain("引用")
    expect(c.querySelector("code")?.textContent).toBe("code")
  })

  it("围栏代码块渲染为 pre>code,并带高亮 class", async () => {
    const c = await renderHTML("```go\nfunc main() {}\n```")
    const code = c.querySelector("pre code")
    expect(code?.textContent).toContain("func main()")
    expect(code?.className).toContain("hljs")
  })

  it("GFM 表格渲染为 table", async () => {
    const c = await renderHTML("| 步数 | FID |\n| --- | --- |\n| 50 | 12.3 |")
    expect(c.querySelector("table")).not.toBeNull()
    expect(c.querySelector("table")?.textContent).toContain("12.3")
  })

  it("单个换行渲染为换行(软换行)", async () => {
    const c = await renderHTML("第一行\n第二行")
    expect(c.querySelector("br")).not.toBeNull()
  })

  it("行内与块级公式渲染为公式,可见层不显示原始符号", async () => {
    const c = await renderHTML("行内 $x^2$ 与块级:\n\n$$\n\\frac{a}{b}\n$$")
    expect(c.querySelectorAll(".katex").length).toBeGreaterThan(0)
    // KaTeX 会在 <annotation> 中保留源码(便于复制与无障碍),可见层不得出现原始 TeX
    const visible = Array.from(c.querySelectorAll(".katex-html"))
      .map((el) => el.textContent ?? "")
      .join("")
    expect(visible).not.toContain("\\frac")
  })

  it("链接在新标签页打开并带 noreferrer", async () => {
    const c = await renderHTML("[文档](https://example.com/a)")
    const a = c.querySelector("a")
    expect(a?.getAttribute("href")).toBe("https://example.com/a")
    expect(a?.getAttribute("target")).toBe("_blank")
    expect(a?.getAttribute("rel")).toContain("noreferrer")
  })

  it("外链图片渲染为 img", async () => {
    render(<RichContent content="![示意图](https://example.com/a.png)" />)
    const img = await screen.findByRole("img")
    expect(img.getAttribute("alt")).toBe("示意图")
    expect(img.getAttribute("src")).toBe("https://example.com/a.png")
  })

  it("受保护图片经带令牌取回后以本地对象地址呈现", async () => {
    render(<RichContent content="![图](/api/resources/abc/preview)" />)
    const img = await screen.findByRole("img")
    expect(img.getAttribute("src")).toBe("blob:mock")
  })

  it("整行图片 URL 自动转为图片", async () => {
    const { container } = render(<RichContent content={"https://example.com/b.png"} />)
    // 自动转换的图片没有 alt,语义上不进入 img 角色,这里直接查元素
    await waitFor(() => expect(container.querySelector("img")).not.toBeNull())
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/b.png")
  })
})

describe("RichContent 安全", () => {
  it("原始 HTML 被丢弃,不产生元素或事件属性", async () => {
    const c = await renderHTML("<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>")
    expect(c.querySelector("script")).toBeNull()
    expect(c.querySelector("img")).toBeNull()
    expect(c.querySelector("[onerror]")).toBeNull()
    expect(c.innerHTML).not.toContain("alert(1)")
  })

  it("javascript: 链接不被保留为可点击协议", async () => {
    const c = await renderHTML("[点我](javascript:alert(1))")
    const href = c.querySelector("a")?.getAttribute("href") ?? ""
    expect(href).not.toContain("javascript:")
  })
})

describe("RichContent 摘要模式(信息流卡片)", () => {
  it("只呈现去标记的纯文本,不产生标题/加粗结构", async () => {
    const c = render(<RichContent content={"# 标题\n\n**粗体** 内容"} clampText />).container
    expect(c.querySelector("h1")).toBeNull()
    expect(c.querySelector("strong")).toBeNull()
    expect(c.textContent ?? "").toContain("标题")
    expect(c.textContent ?? "").toContain("粗体 内容")
    expect(c.textContent ?? "").not.toContain("**")
  })
})

describe("RichContent 空内容", () => {
  it("空白正文显示占位文案", async () => {
    render(<RichContent content="   " emptyText="(无正文)" />)
    expect(screen.getByText("(无正文)")).toBeTruthy()
  })
})
