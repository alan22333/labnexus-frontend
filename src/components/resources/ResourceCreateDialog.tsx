import { useCallback, useEffect, useState } from "react"
import { FileText, Link2, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"

import { TagPicker } from "@/components/documents/TagPicker"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ApiError, resourceApi } from "@/lib/api"
import type { Resource, ResourceCategory, ResourceType } from "@/lib/types"

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  initialType?: ResourceType
  resource?: Resource | null // 编辑模式
  onSaved?: () => void
}

const UNCATEGORIZED = "__none__"

/** 资源创建/编辑对话框(link 表单 或 file 上传) */
export function ResourceCreateDialog({ open, onOpenChange, initialType = "link", resource, onSaved }: Props) {
  const [type, setType] = useState<ResourceType>(initialType)
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [tagIds, setTagIds] = useState<string[]>([])
  const [categoryId, setCategoryId] = useState<string>(UNCATEGORIZED)
  const [categories, setCategories] = useState<ResourceCategory[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dupResourceId, setDupResourceId] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      const data = await resourceApi.categories()
      setCategories(data.categories ?? [])
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setType(resource?.type ?? initialType)
    setTitle(resource?.title ?? "")
    setUrl(resource?.url ?? "")
    setDescription(resource?.description ?? "")
    setFile(null)
    setTagIds(resource?.tags?.map((t) => t.id) ?? [])
    setCategoryId(resource?.category?.id ?? UNCATEGORIZED)
    setError("")
    setDupResourceId(null)
    void loadCategories()
  }, [open, resource, initialType, loadCategories])

  async function save(force = false) {
    if (!title.trim()) {
      setError("标题不能为空")
      return
    }
    setBusy(true)
    setError("")
    try {
      const catId = categoryId === UNCATEGORIZED ? undefined : categoryId
      if (resource) {
        await resourceApi.update(resource.id, {
          title: title.trim(),
          description,
          tag_ids: tagIds,
          category_id: catId ?? null,
        })
        toast.success("资源已更新")
      } else if (type === "link") {
        await resourceApi.createLink({
          title: title.trim(),
          url: url.trim(),
          description,
          tag_ids: tagIds,
          category_id: catId,
          force,
        })
        toast.success("链接已收藏")
      } else {
        if (!file) {
          setError("请选择文件")
          setBusy(false)
          return
        }
        await resourceApi.upload({ file, title: title.trim(), description, tag_ids: tagIds, category_id: catId })
        toast.success("文件已上传")
      }
      setDupResourceId(null)
      onOpenChange(false)
      onSaved?.()
    } catch (err) {
      // 链接重复 → 弹出二次确认,确认后 force 重试
      if (!resource && type === "link" && err instanceof ApiError && err.status === 409) {
        const existing = (err.data as { existing_id?: string } | undefined)?.existing_id
        if (existing) {
          setDupResourceId(existing)
          setBusy(false)
          return
        }
      }
      setError(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{resource ? "编辑资源" : type === "link" ? "新建链接" : "上传文件"}</DialogTitle>
          <DialogDescription>
            资源为课题组共享库,所有成员可见;仅上传者或管理员可修改
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {!resource && (
            <div className="space-y-2">
              <Label>资源类型</Label>
              <Select value={type} onValueChange={(v) => setType(v as ResourceType)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">
                    <span className="flex items-center gap-2"><Link2 className="size-4 text-muted-foreground" />链接</span>
                  </SelectItem>
                  <SelectItem value="file">
                    <span className="flex items-center gap-2"><FileText className="size-4 text-muted-foreground" />文件</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="res-title">标题</Label>
            <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="资源的标题" maxLength={300} />
          </div>

          {!resource && type === "link" && (
            <div className="space-y-2">
              <Label htmlFor="res-url">URL</Label>
              <Input id="res-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…(仅 http/https)" />
            </div>
          )}

          {!resource && type === "file" && (
            <div className="space-y-2">
              <Label htmlFor="res-file">文件</Label>
              <label
                htmlFor="res-file"
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Upload className="size-6" />
                {file ? <span className="font-medium text-foreground">{file.name}</span> : <span>点击选择文件(PDF/图片/文档/视频等)</span>}
                <input
                  id="res-file"
                  type="file"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          <div className="space-y-2">
            <Label>分类</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="未分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNCATEGORIZED}>未分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="res-desc">描述</Label>
            <Textarea id="res-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="用途 / 备注(可选)" className="min-h-20" />
          </div>

          <div className="space-y-2">
            <Label>标签</Label>
            <TagPicker selected={tagIds} onChange={setTagIds} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={dupResourceId != null} onOpenChange={(v) => !v && setDupResourceId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>该链接已存在于资源库</AlertDialogTitle>
            <AlertDialogDescription>
              同一条链接此前已被收藏。确认仍要再收藏一份吗?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => { e.preventDefault(); void save(true) }}
            >
              {busy && <Loader2 className="animate-spin" />} 仍然收藏
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}
