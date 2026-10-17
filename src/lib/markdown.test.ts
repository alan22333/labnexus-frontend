import { describe, expect, it } from "vitest"

import { normalizeBareImageUrls, stripMarkdown } from "@/lib/markdown"

describe("stripMarkdown", () => {
  it("去掉标题/强调/行内代码标记,保留文字", () => {
    expect(stripMarkdown("# 标题")).toBe("标题")
    expect(stripMarkdown("**粗体** 与 *斜体*")).toBe("粗体 与 斜体")
    expect(stripMarkdown("用 `go test` 跑测试")).toBe("用 go test 跑测试")
  })

  it("链接保留可见文字,图片整体移除", () => {
    expect(stripMarkdown("见 [文档](https://example.com/a)")).toBe("见 文档")
    expect(stripMarkdown("文字 ![图](https://example.com/a.png) 结束")).toBe("文字 结束")
  })

  it("去掉列表/引用/分隔线等块级标记", () => {
    expect(stripMarkdown("- 第一项\n- 第二项")).toBe("第一项\n第二项")
    expect(stripMarkdown("1. 一\n2. 二")).toBe("一\n二")
    expect(stripMarkdown("> 引用")).toBe("引用")
    expect(stripMarkdown("a\n\n---\n\nb")).toBe("a\n\nb")
  })

  it("代码围栏保留内容、去掉围栏行", () => {
    expect(stripMarkdown("```go\nfmt.Println()\n```")).toBe("fmt.Println()")
  })

  it("表格去标记保留单元格文字", () => {
    const out = stripMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |")
    expect(out).toContain("a")
    expect(out).toContain("1")
    expect(out).not.toContain("---")
    expect(out).not.toContain("|")
  })

  it("剥离 HTML 标签", () => {
    expect(stripMarkdown("<b>粗</b>")).toBe("粗")
    expect(stripMarkdown("<script>alert(1)</script>")).not.toContain("<script>")
  })
})

describe("normalizeBareImageUrls", () => {
  it("整行图片 URL 转为 markdown 图片", () => {
    expect(normalizeBareImageUrls("https://a.com/x.png")).toBe("![](https://a.com/x.png)")
    expect(normalizeBareImageUrls("/api/resources/abc/preview")).toBe("![](/api/resources/abc/preview)")
  })

  it("行内 URL 或已是 markdown 链接时保持不变", () => {
    expect(normalizeBareImageUrls("见 https://a.com/x.png 图")).toBe("见 https://a.com/x.png 图")
    expect(normalizeBareImageUrls("[x](https://a.com/x.png)")).toBe("[x](https://a.com/x.png)")
    expect(normalizeBareImageUrls("![a](https://a.com/x.png)")).toBe("![a](https://a.com/x.png)")
  })
})
