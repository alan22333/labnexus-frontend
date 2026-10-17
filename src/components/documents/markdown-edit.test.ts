import { describe, expect, it } from "vitest"

import {
  continueList,
  indentSelection,
  insertBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
} from "@/components/documents/markdown-edit"

describe("wrapSelection", () => {
  it("包裹选中的文字,并把选区留在文字上", () => {
    const r = wrapSelection("hello world", 0, 5, "**", "**", "粗体")
    expect(r.value).toBe("**hello** world")
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("hello")
  })

  it("无选区时插入占位文字并选中它", () => {
    const r = wrapSelection("ab", 1, 1, "**", "**", "粗体")
    expect(r.value).toBe("a**粗体**b")
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("粗体")
  })
})

describe("toggleLinePrefix", () => {
  it("给选中的每一行加上前缀", () => {
    expect(toggleLinePrefix("甲\n乙", 0, 3, "- ").value).toBe("- 甲\n- 乙")
  })

  it("当所有行都已有前缀时移除它", () => {
    expect(toggleLinePrefix("- 甲\n- 乙", 0, 7, "- ").value).toBe("甲\n乙")
  })
})

describe("insertBlock", () => {
  it("插入块级内容并选中块内占位文字", () => {
    const r = insertBlock("abc", 3, "```\n代码\n```", "代码")
    expect(r.value).toBe("abc\n```\n代码\n```")
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("代码")
  })
})

describe("insertLink", () => {
  it("用选中文字作为链接文字,选区落在待填写的地址上", () => {
    const r = insertLink("见文档说明", 1, 3)
    expect(r.value).toBe("见[文档](https://)说明")
    expect(r.value.slice(r.selectionStart, r.selectionEnd)).toBe("https://")
  })

  it("无选区时插入占位链接文字", () => {
    const r = insertLink("", 0, 0)
    expect(r.value).toBe("[链接文字](https://)")
  })
})

describe("continueList", () => {
  it("有序列表回车自动续上递增的序号", () => {
    const r = continueList("1. 甲", 4)
    expect(r.value).toBe("1. 甲\n2. ")
    expect(r.selectionStart).toBe(8)
  })

  it("无序列表回车续上同样的标记", () => {
    expect(continueList("- 甲", 3).value).toBe("- 甲\n- ")
  })

  it("缩进列表保持缩进", () => {
    expect(continueList("  - 甲", 5).value).toBe("  - 甲\n  - ")
  })

  it("空条目回车退出列表", () => {
    const r = continueList("- 甲\n- ", 7)
    expect(r.value).toBe("- 甲\n")
  })

  it("普通段落回车只换行", () => {
    expect(continueList("正文", 2).value).toBe("正文\n")
  })
})

describe("indentSelection", () => {
  it("单个光标位置插入两个空格", () => {
    const r = indentSelection("ab", 1, 1)
    expect(r.value).toBe("a  b")
    expect(r.selectionStart).toBe(3)
  })

  it("多行选区给每一行加缩进", () => {
    expect(indentSelection("甲\n乙", 0, 3).value).toBe("  甲\n  乙")
  })
})
