import { useCallback, useEffect, useState } from "react"
import { FolderKanban, Loader2, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { Link, useNavigate } from "react-router-dom"

import { Avatar } from "@/components/common/Avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { projectApi } from "@/lib/api"
import { timeAgo } from "@/lib/format"
import type { Project } from "@/lib/types"

export function ProjectsPage() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await projectApi.list()
      setProjects(data.projects ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "项目加载失败")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    if (!name.trim()) {
      setError("项目名称不能为空")
      return
    }
    setBusy(true)
    setError("")
    try {
      const { project } = await projectApi.create({ name: name.trim(), description })
      toast.success("项目已创建")
      setCreateOpen(false)
      setName("")
      setDescription("")
      await load()
      // 直接进入新项目详情
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">项目</h1>
          <p className="text-sm text-muted-foreground">任务看板 · 里程碑 · 进度监督</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw /> 刷新
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> 新建项目
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-20 text-center">
          <p className="text-3xl">🗂️</p>
          <p className="mt-2 text-sm text-muted-foreground">暂无项目,创建一个开始推进吧</p>
          <Button className="mt-4" variant="outline" onClick={() => setCreateOpen(true)}>
            新建项目
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`}>
              <Card className="h-full transition-all hover:-translate-y-0.5 hover:shadow-md">
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <FolderKanban className="size-5" />
                  </span>
                  <Badge variant={p.status === "done" ? "secondary" : "default"}>
                    {p.status === "done" ? "已完成" : "进行中"}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2 min-h-8">
                    {p.description || "暂无描述"}
                  </CardDescription>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar name={p.owner?.display_name ?? "?"} id={p.owner?.id} className="size-5" />
                    <span>{p.owner?.display_name}</span>
                    <span className="ml-auto">{timeAgo(p.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>新建项目</DialogTitle>
            <DialogDescription>创建后你将成为项目负责人(owner),可添加成员与里程碑</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="proj-name">项目名称</Label>
              <Input id="proj-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="如:毕业论文 / 组会分享" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-desc">描述</Label>
              <Input id="proj-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="一句话说明目标(可选)" />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={create} disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

