import { useCallback, useEffect, useState } from "react"
import {
  ChevronRight, Folder as FolderIcon, FolderOpen, FolderPlus, Pencil, Plus, RefreshCw, Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { TagBadges } from "@/components/common/TagBadges"
import { DocumentDetailDialog } from "@/components/documents/DocumentDetailDialog"
import { DocumentEditorDialog } from "@/components/documents/DocumentEditorDialog"
import { Button } from "@/components/ui/button"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Card } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { documentApi, spaceApi } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import type { Document, Folder } from "@/lib/types"
import { cn } from "@/lib/utils"

export function SpacePage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDocs, setLoadingDocs] = useState(false)

  // 对话框状态
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parentId: string | null }>({ open: false, parentId: null })
  const [renameTarget, setRenameTarget] = useState<Folder | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Folder | null>(null)
  const [deleteDocTarget, setDeleteDocTarget] = useState<Document | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<Document | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadTree = useCallback(async () => {
    try {
      const data = await spaceApi.getSpace()
      setFolders(data.folders ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "空间加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDocs = useCallback(async (folderId: string | null) => {
    setLoadingDocs(true)
    try {
      const data = await documentApi.listMine(folderId ? { folder_id: folderId } : undefined)
      setDocs(data.documents ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "文档加载失败")
    } finally {
      setLoadingDocs(false)
    }
  }, [])

  useEffect(() => {
    void loadTree()
  }, [loadTree])

  useEffect(() => {
    void loadDocs(selected)
  }, [selected, loadDocs])

  function openCreateDoc() {
    setEditingDoc(null)
    setEditorOpen(true)
  }

  function openEditDoc(doc: Document) {
    setEditingDoc(doc)
    setEditorOpen(true)
  }

  async function createFolder(parentId: string | null) {
    const input = document.getElementById("new-folder-name") as HTMLInputElement | null
    const name = input?.value.trim()
    if (!name) return
    try {
      await spaceApi.createFolder({ name, parent_id: parentId })
      toast.success("目录已创建")
      setFolderDialog({ open: false, parentId: null })
      await loadTree()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败")
    }
  }

  async function renameFolder() {
    if (!renameTarget) return
    const input = document.getElementById("rename-folder-name") as HTMLInputElement | null
    const name = input?.value.trim()
    if (!name) return
    try {
      await spaceApi.renameFolder(renameTarget.id, { name })
      toast.success("目录已重命名")
      setRenameTarget(null)
      await loadTree()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "重命名失败")
    }
  }

  async function removeFolder() {
    if (!deleteTarget) return
    try {
      await spaceApi.deleteFolder(deleteTarget.id)
      toast.success("目录已删除")
      if (selected === deleteTarget.id) setSelected(null)
      setDeleteTarget(null)
      await loadTree()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
      setDeleteTarget(null)
    }
  }

  async function removeDoc() {
    if (!deleteDocTarget) return
    try {
      await documentApi.remove(deleteDocTarget.id)
      toast.success("文档已删除")
      setDeleteDocTarget(null)
      await loadDocs(selected)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败")
      setDeleteDocTarget(null)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">我的空间</h1>
          <p className="text-sm text-muted-foreground">个人笔记与目录 · 私有内容仅自己可见</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadTree()}>
            <RefreshCw /> 刷新
          </Button>
          <Button size="sm" onClick={openCreateDoc}>
            <Plus /> 新建文档
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[260px_1fr]">
        {/* 目录树 */}
        <Card className="h-fit p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="text-sm font-semibold">目录</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setFolderDialog({ open: true, parentId: null })} aria-label="新建目录">
              <FolderPlus />
            </Button>
          </div>
          {loading ? (
            <div className="space-y-2 p-1">
              <Skeleton className="h-7 w-full" />
              <Skeleton className="h-7 w-3/4" />
              <Skeleton className="h-7 w-2/3" />
            </div>
          ) : (
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className={cn(
                  "flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  selected === null ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
                )}
              >
                <FolderOpen className="size-4 shrink-0" />
                全部文档
              </button>
              {folders.length === 0 && (
                <p className="px-2 pt-1 text-xs text-muted-foreground">还没有目录,点右上角新建</p>
              )}
              <FolderTree
                folders={folders}
                selected={selected}
                onSelect={setSelected}
                onCreate={(parentId) => setFolderDialog({ open: true, parentId })}
                onRename={setRenameTarget}
                onDelete={setDeleteTarget}
              />
            </div>
          )}
        </Card>

        {/* 文档列表 */}
        <div className="space-y-3">
          <div className="px-1 text-sm text-muted-foreground">
            {loadingDocs ? "加载中…" : `共 ${docs.length} 篇文档`}
          </div>
          {loadingDocs ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : docs.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background py-16 text-center">
              <p className="text-sm text-muted-foreground">该目录下暂无文档</p>
              <Button className="mt-4" variant="outline" size="sm" onClick={openCreateDoc}>
                写一篇笔记
              </Button>
            </div>
          ) : (
            docs.map((doc) => (
              <Card key={doc.id} className="p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => { setDetailId(doc.id); setDetailOpen(true) }}
                  >
                    <h3 className="line-clamp-1 text-sm font-semibold">{doc.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{doc.content}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-medium",
                        doc.visibility === "public" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"
                      )}>
                        {doc.visibility === "public" ? "公开" : "私有"}
                      </span>
                      <span>{formatDateTime(doc.created_at)}</span>
                      {doc.pinned && <span>· 置顶</span>}
                    </div>
                    <TagBadges tags={doc.tags} className="mt-1.5" />
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon-sm" aria-label="编辑" onClick={() => openEditDoc(doc)}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="删除"
                      onClick={() => setDeleteDocTarget(doc)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* 新建目录 */}
      <Dialog open={folderDialog.open} onOpenChange={(v) => setFolderDialog((s) => ({ ...s, open: v }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>新建目录</DialogTitle>
            <DialogDescription>
              {folderDialog.parentId ? "创建子目录" : "创建根目录,将显示在「全部文档」下"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="new-folder-name">目录名称</Label>
            <Input id="new-folder-name" placeholder="如:会议记录 / 近期工作" maxLength={100} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialog({ open: false, parentId: null })}>取消</Button>
            <Button onClick={() => void createFolder(folderDialog.parentId)}>创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重命名 */}
      <Dialog open={renameTarget != null} onOpenChange={(v) => !v && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>重命名目录</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="rename-folder-name">目录名称</Label>
            <Input id="rename-folder-name" defaultValue={renameTarget?.name ?? ""} maxLength={100} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>取消</Button>
            <Button onClick={() => void renameFolder()}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除目录 */}
      <AlertDialog open={deleteTarget != null} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除目录「{deleteTarget?.name}」?</AlertDialogTitle>
            <AlertDialogDescription>仅空目录可删除(无子目录)。删除后不可恢复。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeFolder()} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 删除文档 */}
      <AlertDialog open={deleteDocTarget != null} onOpenChange={(v) => !v && setDeleteDocTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除文档「{deleteDocTarget?.title}」?</AlertDialogTitle>
            <AlertDialogDescription>软删除,从列表中移除;公开帖子将同时从信息流消失。</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={() => void removeDoc()} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DocumentEditorDialog
        open={editorOpen}
        onOpenChange={(v) => {
          setEditorOpen(v)
          if (!v) setEditingDoc(null)
        }}
        document={editingDoc}
        defaultFolderId={selected}
        folders={folders}
        onSaved={() => void loadDocs(selected)}
      />
      <DocumentDetailDialog documentId={detailId} open={detailOpen} onOpenChange={setDetailOpen} />
    </div>
  )
}

// 递归目录树
function FolderTree({
  folders, selected, onSelect, onCreate, onRename, onDelete,
}: {
  folders: Folder[]
  selected: string | null
  onSelect: (id: string) => void
  onCreate: (parentId: string) => void
  onRename: (f: Folder) => void
  onDelete: (f: Folder) => void
}) {
  return (
    <div className="space-y-0.5">
      {folders.map((f) => (
        <FolderNode
          key={f.id}
          folder={f}
          depth={0}
          selected={selected}
          onSelect={onSelect}
          onCreate={onCreate}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function FolderNode({
  folder, depth, selected, onSelect, onCreate, onRename, onDelete,
}: {
  folder: Folder
  depth: number
  selected: string | null
  onSelect: (id: string) => void
  onCreate: (parentId: string) => void
  onRename: (f: Folder) => void
  onDelete: (f: Folder) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (folder.children?.length ?? 0) > 0
  return (
    <div>
      <div
        className={cn(
          "group flex items-center gap-0.5 rounded-lg py-1.5 pr-1 text-sm transition-colors",
          selected === folder.id ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted"
        )}
        style={{ paddingLeft: 6 + depth * 14 }}
      >
        <button
          type="button"
          onClick={() => {
            onSelect(folder.id)
            if (hasChildren) setExpanded((v) => !v)
          }}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
        >
          {hasChildren ? (
            <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", expanded && "rotate-90")} />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <FolderIcon className="size-4 shrink-0" />
          <span className="truncate">{folder.name}</span>
        </button>
        <span className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => onCreate(folder.id)} aria-label="建子目录">
            <Plus className="size-3.5" />
          </button>
          <button type="button" className="rounded p-0.5 hover:bg-muted" onClick={() => onRename(folder)} aria-label="重命名">
            <Pencil className="size-3.5" />
          </button>
          <button type="button" className="rounded p-0.5 hover:bg-muted hover:text-destructive" onClick={() => onDelete(folder)} aria-label="删除">
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </div>
      {expanded && hasChildren && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onCreate={onCreate}
              onRename={onRename}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}

