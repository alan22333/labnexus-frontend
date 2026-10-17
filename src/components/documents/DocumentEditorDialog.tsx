import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type KeyboardEvent, type ClipboardEvent, type ReactNode } from "react"
import {
  Bold, Eye, Heading2, ImagePlus, Italic, Link2, List, ListOrdered, Loader2, Quote, Sigma, SquareCode, Table,
} from "lucide-react"
import { toast } from "sonner"

import { RichContent } from "@/components/documents/RichContent"
import { TagPicker } from "@/components/documents/TagPicker"
import {
  continueList, indentSelection, insertBlock, insertLink, toggleLinePrefix, wrapSelection, type EditResult,
} from "@/components/documents/markdown-edit"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { documentApi, resourceApi } from "@/lib/api"
import type { Document, Folder, Visibility } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  document?: Document | null // 传入则为编辑模式
  defaultFolderId?: string | null
  folders?: Folder[]
  onSaved?: () => void
}

const CODE_BLOCK = "```\n代码\n```"
const MATH_BLOCK = "$$\nE = mc^2\n$$"
const TABLE_BLOCK = "| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |"

/** 工具栏按钮:阻止默认行为以免点击时输入框失焦 */
function ToolButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={label}
      aria-label={label}
      className="text-muted-foreground hover:text-foreground"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/** 文档编辑器:新建笔记/帖子 或 编辑(含可见性切换、标签、Markdown 工具栏与实时预览) */
export function DocumentEditorDialog({ open, onOpenChange, document, defaultFolderId, folders, onSaved }: Props) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("private")
  const [folderId, setFolderId] = useState<string>("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState("")
  const taRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // 正文最新值:上传为异步过程,回调里不能依赖闭包里的旧 content
  const latest = useRef("")
  const pendingSel = useRef<[number, number] | null>(null)

  useEffect(() => {
    if (!open) return
    setTitle(document?.title ?? "")
    setContent(document?.content ?? "")
    latest.current = document?.content ?? ""
    setVisibility(document?.visibility ?? "private")
    setFolderId(document?.folder_id ?? defaultFolderId ?? "")
    setTagIds(document?.tags?.map((t) => t.id) ?? [])
    setError("")
  }, [open, document, defaultFolderId])

  // 应用编辑结果:同步正文、复用最新值,并在渲染后恢复选区
  function applyEdit(result: EditResult) {
    latest.current = result.value
    setContent(result.value)
    pendingSel.current = [result.selectionStart, result.selectionEnd]
  }

  useEffect(() => {
    const sel = pendingSel.current
    const el = taRef.current
    if (!sel || !el) return
    pendingSel.current = null
    el.focus()
    el.setSelectionRange(sel[0], sel[1])
  }, [content])

  function selection(): [number, number] {
    const el = taRef.current
    if (!el) return [latest.current.length, latest.current.length]
    return [el.selectionStart, el.selectionEnd]
  }

  function transform(fn: (value: string, start: number, end: number) => EditResult) {
    const [start, end] = selection()
    applyEdit(fn(latest.current, start, end))
  }

  async function uploadAndInsert(file: File) {
    setUploading(true)
    try {
      const { resource } = await resourceApi.upload({ file, title: file.name })
      const url = resource.preview?.url || resource.download_url || ""
      if (!url) throw new Error("图片上传成功但未取得访问地址")
      const marker = `![${resource.title || file.name}](${url})`
      const [start] = selection()
      applyEdit(insertBlock(latest.current, start, marker))
      toast.success("图片已插入正文")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "图片上传失败")
    } finally {
      setUploading(false)
    }
  }

  async function onPickImage(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return
    await uploadAndInsert(file)
  }

  /** 粘贴剪贴板里的图片(截图)时直接上传插图,普通文本粘贴不受影响 */
  function onPaste(e: ClipboardEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.clipboardData?.items ?? [])
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null)
    if (!files.length) return
    e.preventDefault()
    void (async () => {
      for (const f of files) await uploadAndInsert(f)
    })()
  }

  function onDrop(e: DragEvent<HTMLTextAreaElement>) {
    const files = Array.from(e.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"))
    setDragging(false)
    if (!files.length) return
    e.preventDefault()
    void (async () => {
      for (const f of files) await uploadAndInsert(f)
    })()
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 中文输入法回车确认候选词时不拦截
    if (e.nativeEvent.isComposing) return
    const [start, end] = selection()

    if (e.metaKey || e.ctrlKey) {
      const key = e.key.toLowerCase()
      if (key === "b") {
        e.preventDefault()
        applyEdit(wrapSelection(latest.current, start, end, "**", "**", "粗体"))
        return
      }
      if (key === "i") {
        e.preventDefault()
        applyEdit(wrapSelection(latest.current, start, end, "*", "*", "斜体"))
        return
      }
      if (key === "e") {
        e.preventDefault()
        applyEdit(wrapSelection(latest.current, start, end, "`", "`", "代码"))
        return
      }
      if (key === "k") {
        e.preventDefault()
        applyEdit(insertLink(latest.current, start, end))
        return
      }
      return
    }

    if (e.key === "Tab") {
      e.preventDefault()
      applyEdit(indentSelection(latest.current, start, end))
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      applyEdit(continueList(latest.current, start))
    }
  }

  async function save() {
    if (!title.trim()) {
      setError("标题不能为空")
      return
    }
    setBusy(true)
    setError("")
    const payload = {
      title: title.trim(),
      content,
      visibility,
      tag_ids: tagIds,
    }
    try {
      if (document) {
        await documentApi.update(document.id, payload)
        toast.success("文档已更新")
      } else {
        await documentApi.create({
          ...payload,
          folder_id: folderId || null,
        })
        toast.success(visibility === "public" ? "已发布到信息流" : "笔记已保存")
      }
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusy(false)
    }
  }

  const flatFolders = useMemo(
    () =>
      folders
        ? (function flatten(list: Folder[], depth = 0): { id: string; name: string; depth: number }[] {
            return list.flatMap((f) => [
              { id: f.id, name: f.name, depth },
              ...flatten(f.children ?? [], depth + 1),
            ])
          })(folders)
        : [],
    [folders]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{document ? "编辑文档" : "发帖 / 写笔记"}</DialogTitle>
          <DialogDescription>
            私有 = 仅自己可见的笔记;公开 = 发布到课题组信息流(可随时切换)。正文支持 Markdown 语法。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor="doc-title">标题</Label>
            <Input
              id="doc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给内容起个标题"
              maxLength={200}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>可见性</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">🔒 私有(笔记)</SelectItem>
                  <SelectItem value="public">🌍 公开(发帖)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {folders && (
              <div className="space-y-2">
                <Label>目录</Label>
                <Select value={folderId} onValueChange={setFolderId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="不放入目录" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不放入目录</SelectItem>
                    {flatFolders.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {"　".repeat(f.depth)}
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-input bg-muted/40 px-1 py-0.5">
              <ToolButton label="粗体 (Cmd/Ctrl+B)" onClick={() => transform((v, s, e) => wrapSelection(v, s, e, "**", "**", "粗体"))}>
                <Bold />
              </ToolButton>
              <ToolButton label="斜体 (Cmd/Ctrl+I)" onClick={() => transform((v, s, e) => wrapSelection(v, s, e, "*", "*", "斜体"))}>
                <Italic />
              </ToolButton>
              <ToolButton label="标题" onClick={() => transform((v, s, e) => toggleLinePrefix(v, s, e, "## "))}>
                <Heading2 />
              </ToolButton>
              <ToolButton label="无序列表" onClick={() => transform((v, s, e) => toggleLinePrefix(v, s, e, "- "))}>
                <List />
              </ToolButton>
              <ToolButton label="有序列表" onClick={() => transform((v, s, e) => toggleLinePrefix(v, s, e, "1. "))}>
                <ListOrdered />
              </ToolButton>
              <ToolButton label="引用" onClick={() => transform((v, s, e) => toggleLinePrefix(v, s, e, "> "))}>
                <Quote />
              </ToolButton>
              <ToolButton label="行内代码 (Cmd/Ctrl+E)" onClick={() => transform((v, s, e) => wrapSelection(v, s, e, "`", "`", "代码"))}>
                <SquareCode />
              </ToolButton>
              <ToolButton label="代码块" onClick={() => transform((v, s) => insertBlock(v, s, CODE_BLOCK, "代码"))}>
                <SquareCode className="rotate-90" />
              </ToolButton>
              <ToolButton label="链接 (Cmd/Ctrl+K)" onClick={() => transform((v, s, e) => insertLink(v, s, e))}>
                <Link2 />
              </ToolButton>
              <ToolButton label="插入图片" onClick={() => fileRef.current?.click()}>
                <ImagePlus />
              </ToolButton>
              <ToolButton label="公式" onClick={() => transform((v, s) => insertBlock(v, s, MATH_BLOCK, "E = mc^2"))}>
                <Sigma />
              </ToolButton>
              <ToolButton label="表格" onClick={() => transform((v, s) => insertBlock(v, s, TABLE_BLOCK, "列 1"))}>
                <Table />
              </ToolButton>
              {uploading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="doc-content" className="text-xs text-muted-foreground">Markdown 正文</Label>
                <Textarea
                  id="doc-content"
                  ref={taRef}
                  value={content}
                  onChange={(e) => {
                    latest.current = e.target.value
                    setContent(e.target.value)
                  }}
                  onKeyDown={onKeyDown}
                  onPaste={onPaste}
                  onDrop={onDrop}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  placeholder={"支持 Markdown:标题、**粗体**、列表、`代码`、表格、$公式$\n\n可直接粘贴或拖拽图片上传"}
                  className={`h-80 min-h-80 resize-none font-mono text-sm ${dragging ? "border-primary ring-3 ring-ring/30" : ""}`}
                />
              </div>
              <div className="space-y-1">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="size-3.5" />
                  实时预览
                </span>
                <div className="h-80 overflow-y-auto rounded-lg border border-input bg-card px-3 py-2">
                  {content.trim() ? (
                    <RichContent content={content} imageLink={false} />
                  ) : (
                    <p className="text-sm text-muted-foreground">左侧输入正文,这里会同步呈现排版效果。</p>
                  )}
                </div>
              </div>
            </div>

            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickImage} />
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <TagPicker selected={tagIds} onChange={setTagIds} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
