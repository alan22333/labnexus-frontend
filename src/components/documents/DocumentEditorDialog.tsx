import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { TagPicker } from "@/components/documents/TagPicker"
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
import { documentApi } from "@/lib/api"
import type { Document, Folder, Visibility } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  document?: Document | null // 传入则为编辑模式
  defaultFolderId?: string | null
  folders?: Folder[]
  onSaved?: () => void
}

/** 文档编辑器:新建笔记/帖子 或 编辑(含可见性切换、标签) */
export function DocumentEditorDialog({ open, onOpenChange, document, defaultFolderId, folders, onSaved }: Props) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [visibility, setVisibility] = useState<Visibility>("private")
  const [folderId, setFolderId] = useState<string>("")
  const [tagIds, setTagIds] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    setTitle(document?.title ?? "")
    setContent(document?.content ?? "")
    setVisibility(document?.visibility ?? "private")
    setFolderId(document?.folder_id ?? defaultFolderId ?? "")
    setTagIds(document?.tags?.map((t) => t.id) ?? [])
    setError("")
  }, [open, document, defaultFolderId])

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

  const flatFolders = folders
    ? (function flatten(list: Folder[], depth = 0): { id: string; name: string; depth: number }[] {
        return list.flatMap((f) => [
          { id: f.id, name: f.name, depth },
          ...flatten(f.children ?? [], depth + 1),
        ])
      })(folders)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{document ? "编辑文档" : "发帖 / 写笔记"}</DialogTitle>
          <DialogDescription>
            私有 = 仅自己可见的笔记;公开 = 发布到课题组信息流(可随时切换)
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
            <Label htmlFor="doc-content">正文</Label>
            <Textarea
              id="doc-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="支持 Markdown 语法,以纯文本展示…"
              className="min-h-44 font-mono text-sm"
            />
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
