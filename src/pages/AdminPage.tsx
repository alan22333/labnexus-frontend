import { useCallback, useEffect, useState, type FormEvent } from "react"
import {
  Copy, Loader2, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Ticket, Trash2, Users,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/hooks/use-auth"
import { adminApi } from "@/lib/api"
import type { Invite, Role, TaskType, User } from "@/lib/types"
import { timeAgo } from "@/lib/format"

const ROLE_LABEL: Record<Role, string> = {
  admin: "管理员",
  supervisor: "导师",
  student: "学生",
}

const ROLE_OPTIONS: Role[] = ["admin", "supervisor", "student"]

const ADMIN_ERROR_MAP: Record<string, string> = {
  "admin permission required": "需要管理员权限",
  "invalid role, expected admin/supervisor/student": "角色不合法",
  "cannot demote yourself": "不能把自己降级为非管理员",
  "cannot demote the last admin": "系统至少需要保留一名管理员",
  "invite code already exists": "邀请码已存在，请换一个",
  "invite code is empty": "邀请码不能为空",
  "task type name is empty": "任务类型名称不能为空",
  "task type already exists": "任务类型名称已存在",
  "task type not found": "任务类型不存在或已被删除",
  "user not found": "成员不存在或已被删除",
  "invite not found": "邀请码不存在或已被撤销",
}

function friendlyAdminError(err: unknown): string {
  const message = err instanceof Error ? err.message : "操作失败，请稍后重试"
  return ADMIN_ERROR_MAP[message] ?? message
}

function shortID(id: string | null | undefined): string {
  return id ? `${id.slice(0, 8)}…` : "—"
}

function inviteURL(code: string): string {
  return `${window.location.origin}/login?mode=register&code=${encodeURIComponent(code)}`
}

export function AdminPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState("users")

  if (user?.role !== "admin") {
    return (
      <Card className="mx-auto max-w-md p-10 text-center">
        <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 text-lg font-medium">无权访问</p>
        <p className="mt-2 text-sm text-muted-foreground">管理后台仅管理员可用</p>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Settings className="size-5 text-primary" /> 管理后台
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">成员、邀请码与任务类型维护</p>
        </div>
        <Badge variant="secondary" className="mb-0.5">
          <ShieldCheck /> 仅管理员
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users"><Users /> 成员</TabsTrigger>
          <TabsTrigger value="invites"><Ticket /> 邀请码</TabsTrigger>
          <TabsTrigger value="task-types"><Settings /> 任务类型</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><MembersPanel /></TabsContent>
        <TabsContent value="invites"><InvitesPanel /></TabsContent>
        <TabsContent value="task-types"><TaskTypesPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

function MembersPanel() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [keyword, setKeyword] = useState("")
  const [loading, setLoading] = useState(true)
  const [busyID, setBusyID] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.users(keyword.trim())
      setUsers(data.users ?? [])
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250)
    return () => clearTimeout(timer)
  }, [load])

  async function changeRole(target: User, role: Role) {
    if (target.role === role) return
    setBusyID(target.id)
    try {
      const data = await adminApi.changeRole(target.id, role)
      setUsers((list) => list.map((u) => (u.id === target.id ? data.user : u)))
      toast.success(`${target.display_name} 的角色已改为${ROLE_LABEL[role]}`)
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setBusyID(null)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>成员管理</CardTitle>
          <CardDescription>调整角色后即时生效；系统会阻止降级自己或最后一名管理员。</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索用户名 / 昵称"
              className="w-56 pl-8"
            />
          </div>
          <Button variant="outline" size="icon" onClick={() => void load()} disabled={loading} title="刷新">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : users.length === 0 ? (
          <EmptyState message="没有找到成员" />
        ) : (
          <div className="space-y-2">
            {users.map((u) => {
              const isSelf = u.id === currentUser?.id
              return (
                <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
                  <Avatar name={u.display_name} id={u.id} src={u.avatar_url} className="size-9" />
                  <div className="min-w-40 flex-1">
                    <p className="font-medium">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username} · 注册于 {timeAgo(u.created_at)}</p>
                  </div>
                  {isSelf && <Badge variant="outline">当前账号</Badge>}
                  <Select
                    value={u.role}
                    onValueChange={(value) => void changeRole(u, value as Role)}
                    disabled={isSelf || busyID === u.id}
                  >
                    <SelectTrigger className="w-32" title={isSelf ? "不能修改自己的角色" : undefined}>
                      {busyID === u.id ? <Loader2 className="animate-spin" /> : <SelectValue />}
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role} value={role}>{ROLE_LABEL[role]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function InvitesPanel() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [customCode, setCustomCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.invites()
      setInvites(data.invites ?? [])
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createInvite(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const data = await adminApi.createInvite(customCode.trim() || undefined)
      setInvites((list) => [data.invite, ...list])
      setCreateOpen(false)
      setCustomCode("")
      toast.success("邀请码已生成", { description: data.invite.code })
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setBusy(false)
    }
  }

  async function copyInvite(code: string) {
    try {
      await navigator.clipboard.writeText(inviteURL(code))
      toast.success("注册链接已复制")
    } catch {
      toast.error("复制失败，请手动复制邀请码")
    }
  }

  async function deleteInvite() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminApi.deleteInvite(deleteTarget.id)
      setInvites((list) => list.filter((item) => item.id !== deleteTarget.id))
      toast.success("邀请码已撤销")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>邀请码管理</CardTitle>
            <CardDescription>自动或自定义生成，未使用的码可直接复制注册链接。</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} 刷新
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> 生成邀请码
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : invites.length === 0 ? (
            <EmptyState message="暂无邀请码" />
          ) : (
            <div className="space-y-2">
              {invites.map((invite) => {
                const used = Boolean(invite.used_by)
                const createdAgo = timeAgo(invite.created_at)
                return (
                  <div key={invite.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
                    <div className="min-w-52 flex-1">
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-2 py-1 text-sm font-semibold tracking-wide">{invite.code}</code>
                        <Badge variant={used ? "secondary" : "default"}>{used ? "已使用" : "未使用"}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        创建人 {shortID(invite.created_by)}
                        {createdAgo && ` · ${createdAgo}`}
                        {used && ` · 使用者 ${shortID(invite.used_by)}${invite.used_at ? ` · ${timeAgo(invite.used_at)}` : ""}`}
                      </p>
                    </div>
                    {!used && (
                      <Button variant="outline" size="sm" onClick={() => void copyInvite(invite.code)}>
                        <Copy /> 复制链接
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(invite)} title="撤销">
                      <Trash2 />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>生成邀请码</DialogTitle>
            <DialogDescription>留空由系统生成随机码；自定义码不能与已有邀请码重复。</DialogDescription>
          </DialogHeader>
          <form onSubmit={createInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-code">自定义邀请码（可选）</Label>
              <Input
                id="invite-code"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                placeholder="如: 2026-LAB"
                maxLength={32}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />} 生成
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤销邀请码？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `邀请码 ${deleteTarget.code} 将不能再用于注册，此操作不可恢复。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={(e) => { e.preventDefault(); void deleteInvite() }}>
              {deleting && <Loader2 className="animate-spin" />} 撤销
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

type TaskTypeForm = {
  name: string
  color: string
  sort: number
  active: boolean
}

const EMPTY_TASK_TYPE: TaskTypeForm = { name: "", color: "#94a3b8", sort: 0, active: true }

function TaskTypesPanel() {
  const [types, setTypes] = useState<TaskType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<TaskType | null>(null)
  const [form, setForm] = useState<TaskTypeForm>(EMPTY_TASK_TYPE)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<TaskType | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await adminApi.taskTypes()
      setTypes(data.task_types ?? [])
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function openCreate() {
    setEditing(null)
    setForm({ ...EMPTY_TASK_TYPE, sort: (types.at(-1)?.sort ?? 0) + 1 })
    setDialogOpen(true)
  }

  function openEdit(item: TaskType) {
    setEditing(item)
    setForm({ name: item.name, color: item.color, sort: item.sort, active: item.active })
    setDialogOpen(true)
  }

  async function saveTaskType(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      toast.error("任务类型名称不能为空")
      return
    }
    setBusy(true)
    try {
      if (editing) {
        const data = await adminApi.updateTaskType(editing.id, {
          name: form.name.trim(),
          color: form.color,
          sort: form.sort,
          active: form.active,
        })
        setTypes((list) => list.map((item) => item.id === editing.id ? data.task_type : item))
        toast.success("任务类型已更新")
      } else {
        const data = await adminApi.createTaskType({ name: form.name.trim(), color: form.color })
        setTypes((list) => [...list, data.task_type])
        toast.success("任务类型已创建")
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setBusy(false)
    }
  }

  async function deleteTaskType() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminApi.deleteTaskType(deleteTarget.id)
      setTypes((list) => list.filter((item) => item.id !== deleteTarget.id))
      toast.success("任务类型已删除")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>任务类型</CardTitle>
            <CardDescription>停用后不再出现在新任务下拉；删除后已有任务会回退为未分类。</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />} 刷新
            </Button>
            <Button size="sm" onClick={openCreate}><Plus /> 新建类型</Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : types.length === 0 ? (
            <EmptyState message="暂无任务类型" />
          ) : (
            <div className="space-y-2">
              {types.map((item) => (
                <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
                  <span className="size-3 rounded-full ring-2 ring-background" style={{ backgroundColor: item.color }} />
                  <div className="min-w-44 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.name}</span>
                      {item.builtin && <Badge variant="outline">内置</Badge>}
                      <Badge variant={item.active ? "secondary" : "destructive"}>{item.active ? "启用" : "停用"}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">颜色 {item.color} · 排序 {item.sort}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(item)} title="编辑"><Pencil /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setDeleteTarget(item)} title="删除"><Trash2 /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑任务类型" : "新建任务类型"}</DialogTitle>
            <DialogDescription>名称需唯一；颜色用于任务卡片和看板标签。</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTaskType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type-name">名称</Label>
              <Input id="type-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如: 实验" maxLength={40} autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-color">颜色</Label>
              <div className="flex items-center gap-2">
                <Input id="type-color" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-9 w-14 cursor-pointer p-1" />
                <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="#94a3b8" maxLength={7} />
              </div>
            </div>
            {editing && (
              <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type-sort">排序</Label>
                  <Input id="type-sort" type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })} />
                </div>
                <Label className="mb-2 cursor-pointer">
                  <Checkbox checked={form.active} onCheckedChange={(checked) => setForm({ ...form, active: checked === true })} />
                  启用
                </Label>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />} 保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除任务类型？</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? `“${deleteTarget.name}”删除后，引用它的已有任务将回退为未分类。` : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
            <AlertDialogAction variant="destructive" disabled={deleting} onClick={(e) => { e.preventDefault(); void deleteTaskType() }}>
              {deleting && <Loader2 className="animate-spin" />} 删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed py-14 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )
}
