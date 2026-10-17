import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DocumentEditorDialog } from "@/components/documents/DocumentEditorDialog"

const mocks = vi.hoisted(() => ({
  upload: vi.fn(() =>
    Promise.resolve({
      resource: { id: "r1", title: "shot.png", preview: { url: "/api/resources/r1/preview" } },
    })
  ),
}))

vi.mock("@/lib/api", () => ({
  tagApi: { list: vi.fn(() => Promise.resolve({ tags: [] })), create: vi.fn() },
  documentApi: {
    listMine: vi.fn(() => Promise.resolve({ documents: [] })),
    create: vi.fn(() => Promise.resolve({ document: { id: "d1" } })),
    update: vi.fn(),
    remove: vi.fn(),
    get: vi.fn(),
    feed: vi.fn(),
    toggleReaction: vi.fn(),
  },
  resourceApi: { upload: mocks.upload, list: vi.fn(() => Promise.resolve({ resources: [], pagination: {} })) },
  fetchBlob: vi.fn(() => Promise.resolve(new Blob(["x"], { type: "image/png" }))),
}))

function setup() {
  render(<DocumentEditorDialog open onOpenChange={() => {}} />)
  return screen.getByLabelText("Markdown 正文") as HTMLTextAreaElement
}

function typeInto(ta: HTMLTextAreaElement, value: string, selection?: [number, number]) {
  fireEvent.change(ta, { target: { value } })
  if (selection) ta.setSelectionRange(selection[0], selection[1])
}

describe("DocumentEditorDialog 工具栏与快捷键", () => {
  beforeEach(() => {
    mocks.upload.mockClear()
  })

  it("工具栏加粗按钮把选中文字包成粗体,并同步到预览", async () => {
    const ta = setup()
    typeInto(ta, "结论很重要", [2, 4])
    fireEvent.click(screen.getByRole("button", { name: "粗体 (Cmd/Ctrl+B)" }))
    expect(ta.value).toBe("结论**很重**要")
    await waitFor(() => expect(document.querySelector("strong")?.textContent).toBe("很重"))
  })

  it("Cmd/Ctrl+B 快捷键加粗", () => {
    const ta = setup()
    typeInto(ta, "abc", [0, 3])
    fireEvent.keyDown(ta, { key: "b", ctrlKey: true })
    expect(ta.value).toBe("**abc**")
  })

  it("列表回车自动续上标记", () => {
    const ta = setup()
    typeInto(ta, "- 甲", [4, 4])
    fireEvent.keyDown(ta, { key: "Enter" })
    expect(ta.value).toBe("- 甲\n- ")
  })

  it("中文输入法组词回车不拦截", () => {
    const ta = setup()
    typeInto(ta, "- 甲", [4, 4])
    fireEvent.keyDown(ta, { key: "Enter", isComposing: true })
    expect(ta.value).toBe("- 甲")
  })

  it("预览按 Markdown 结构渲染标题与公式", async () => {
    const ta = setup()
    typeInto(ta, "# 组会安排\n\n$x^2$")
    await waitFor(() => expect(document.querySelector(".markdown-body h1")?.textContent).toBe("组会安排"))
    expect(document.querySelectorAll(".katex").length).toBeGreaterThan(0)
  })

  it("无选区时点链接按钮插入待填地址", () => {
    const ta = setup()
    typeInto(ta, "见说明", [3, 3])
    fireEvent.click(screen.getByRole("button", { name: "链接 (Cmd/Ctrl+K)" }))
    expect(ta.value).toBe("见说明[链接文字](https://)")
  })

  it("粘贴图片直接上传并插图", async () => {
    const ta = setup()
    typeInto(ta, "", [0, 0])
    const file = new File(["x"], "shot.png", { type: "image/png" })
    fireEvent.paste(ta, {
      clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => file }] },
    })
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(ta.value).toContain("![shot.png](/api/resources/r1/preview)"))
  })
})
