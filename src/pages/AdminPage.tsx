import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  Copy, Loader2, Pencil, Plus, RefreshCw, Search, Settings, ShieldCheck, Ticket, Trash2, Users,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">后台管理</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">维护课题组成员、注册邀请码与任务类型字典</p>
        </div>
        <Badge variant="outline" className="mt-0.5 gap-1.5 px-2.5 py-1">
          <ShieldCheck className="size-3.5" /> 仅管理员可见
        </Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="users"><Users /> 成员</TabsTrigger>
          <TabsTrigger value="invites"><Ticket /> 邀请码</TabsTrigger>
          <TabsTrigger value="task-types"><Settings /> 任务类型</TabsTrigger>
        </TabsList>
        <TabsContent value="users" className="mt-4"><MembersPanel /></TabsContent>
        <TabsContent value="invites" className="mt-4"><InvitesPanel /></TabsContent>
        <TabsContent value="task-types" className="mt-4"><TaskTypesPanel /></TabsContent>
      </Tabs>
    </div>
  )
}

/* ---------- 通用壳 ---------- */

/** 管理面板:统一「标题 + 说明 + 操作区」的头部与全宽内容区 */
function Panel({
  title, description, actions, children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-card shadow-card ring-1 ring-foreground/[0.07]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      {children}
    </section>
  )
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-5 py-2.5 text-left text-xs font-medium text-muted-foreground ${className ?? ""}`}>
      {children}
    </th>
  )
}

function emptyRow(colSpan: number, message: string) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-muted-foreground">
        {message}
      </td>
    </tr>
  )
}

function skeletonRows(count: number) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-11 rounded-lg" />
      ))}
    </div>
  )
}

/* ---------- 成员管理 ---------- */

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

  const counts = ROLE_OPTIONS.map((role) => ({
    role,
    n: users.filter((u) => u.role === role).length,
  }))

  return (
    <Panel
      title={`成员管理（${users.length}）`}
      description="调整角色后即时生效；系统会阻止降级自己或最后一名管理员。"
      actions={
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="搜索用户名 / 昵称"
              className="h-8 w-52 bg-background pl-8"
            />
          </div>
          <Button variant="outline" size="icon-sm" onClick={() => void load()} disabled={loading} title="刷新">
            {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          </Button>
        </>
      }
    >
      {!loading && users.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
          {counts.map(({ role, n }) => (
            <span key={role}>
              {ROLE_LABEL[role]} <b className="font-medium text-foreground tabular-nums">{n}</b>
            </span>
          ))}
        </div>
      )}

      {loading ? (
        skeletonRows(5)
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <Th>成员</Th>
                <Th className="hidden sm:table-cell">注册时间</Th>
                <Th>角色</Th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0
                ? emptyRow(3, "没有找到成员")
                : users.map((u) => {
                    const isSelf = u.id === currentUser?.id
                    return (
                      <tr key={u.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.display_name} id={u.id} src={u.avatar_url} className="size-8" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium">{u.display_name}</span>
                                {isSelf && <Badge variant="outline">当前账号</Badge>}
                              </div>
                              <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                            </div>
                          </div>
                        </td>
                        <td className="hidden px-5 py-2.5 text-xs text-muted-foreground sm:table-cell">
                          {timeAgo(u.created_at)}
                        </td>
                        <td className="px-5 py-2.5">
                          <Select
                            value={u.role}
                            onValueChange={(value) => void changeRole(u, value as Role)}
                            disabled={isSelf || busyID === u.id}
                          >
                            <SelectTrigger
                              className="h-8 w-28"
                              title={isSelf ? "不能修改自己的角色" : undefined}
                            >
                              {busyID === u.id ? <Loader2 className="animate-spin" /> : <SelectValue />}
                            </SelectTrigger>
                            <SelectContent>
                              {ROLE_OPTIONS.map((role) => (
                                <SelectItem key={role} value={role}>{ROLE_LABEL[role]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/* ---------- 邀请码管理 ---------- */

function InvitesPanel() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [customCode, setCustomCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Invite | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inviteData, userData] = await Promise.all([adminApi.invites(), adminApi.users()])
      setInvites(inviteData.invites ?? [])
      setUsers(userData.users ?? [])
    } catch (err) {
      toast.error(friendlyAdminError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  const userName = useCallback(
    (id: string | null | undefined) => {
      if (!id) return "—"
      return users.find((u) => u.id === id)?.display_name ?? shortID(id)
    },
    [users],
  )

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

  const unused = invites.filter((i) => !i.used_by).length

  return (
    <>
      <Panel
        title={`邀请码管理（${invites.length}）`}
        description="注册需要邀请码。未使用的码可直接复制注册链接发给新成员。"
        actions={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => void load()} disabled={loading} title="刷新">
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> 生成邀请码
            </Button>
          </>
        }
      >
        {!loading && invites.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
            <span>未使用 <b className="font-medium text-foreground tabular-nums">{unused}</b></span>
            <span>已使用 <b className="font-medium text-foreground tabular-nums">{invites.length - unused}</b></span>
          </div>
        )}

        {loading ? (
          skeletonRows(3)
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th>邀请码</Th>
                  <Th>状态</Th>
                  <Th className="hidden sm:table-cell">创建 / 使用</Th>
                  <Th className="text-right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {invites.length === 0
                  ? emptyRow(4, "暂无邀请码，点右上角「生成邀请码」创建")
                  : invites.map((invite) => {
                      const used = Boolean(invite.used_by)
                      const createdAgo = timeAgo(invite.created_at)
                      return (
                        <tr key={invite.id} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-5 py-3">
                            <code className="rounded-md bg-muted px-2 py-1 text-[13px] font-semibold tracking-wide">
                              {invite.code}
                            </code>
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={used ? "secondary" : "default"}>{used ? "已使用" : "未使用"}</Badge>
                          </td>
                          <td className="hidden px-5 py-3 text-xs text-muted-foreground sm:table-cell">
                            <div>创建人 {userName(invite.created_by)}{createdAgo && ` · ${createdAgo}`}</div>
                            {used && (
                              <div className="mt-0.5">
                                使用者 {userName(invite.used_by)}
                                {invite.used_at && ` · ${timeAgo(invite.used_at)}`}
                              </div>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {!used && (
                                <Button variant="outline" size="sm" onClick={() => void copyInvite(invite.code)}>
                                  <Copy /> 复制链接
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => setDeleteTarget(invite)}
                                title="撤销邀请码"
                              >
                                <Trash2 />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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

/* ---------- 任务类型管理 ---------- */

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
      <Panel
        title={`任务类型（${types.length}）`}
        description="停用后不再出现在新建任务下拉；删除后已有任务会回退为未分类。"
        actions={
          <>
            <Button variant="outline" size="icon-sm" onClick={() => void load()} disabled={loading} title="刷新">
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            </Button>
            <Button size="sm" onClick={openCreate}>
              <Plus /> 新建类型
            </Button>
          </>
        }
      >
        {loading ? (
          skeletonRows(4)
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <Th>名称</Th>
                  <Th>状态</Th>
                  <Th className="hidden text-center sm:table-cell">排序</Th>
                  <Th className="text-right">操作</Th>
                </tr>
              </thead>
              <tbody>
                {types.length === 0
                  ? emptyRow(4, "暂无任务类型")
                  : types.map((item) => (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: item.color }}
                              aria-hidden
                            />
                            <span className="font-medium">{item.name}</span>
                            {item.builtin && <Badge variant="outline">内置</Badge>}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={item.active ? "secondary" : "destructive"}>
                            {item.active ? "启用" : "停用"}
                          </Badge>
                        </td>
                        <td className="hidden px-5 py-3 text-center text-xs text-muted-foreground tabular-nums sm:table-cell">
                          {item.sort}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" onClick={() => openEdit(item)} title="编辑">
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setDeleteTarget(item)}
                              title="删除"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑任务类型" : "新建任务类型"}</DialogTitle>
            <DialogDescription>名称需唯一；颜色仅用于任务卡片与看板标签的区分。</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveTaskType} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type-name">名称</Label>
              <Input
                id="type-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如: 实验"
                maxLength={40}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type-color">标识色</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="type-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-8 w-12 cursor-pointer p-1"
                  aria-label="选择颜色"
                />
                <span className="text-xs text-muted-foreground">
                  用于任务卡片左上角的分类色点
                </span>
              </div>
            </div>
            {editing && (
              <div className="grid grid-cols-[1fr_auto] items-end gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type-sort">排序</Label>
                  <Input
                    id="type-sort"
                    type="number"
                    value={form.sort}
                    onChange={(e) => setForm({ ...form, sort: Number(e.target.value) || 0 })}
                  />
                </div>
                <Label className="mb-2 cursor-pointer">
                  <Checkbox
                    checked={form.active}
                    onCheckedChange={(checked) => setForm({ ...form, active: checked === true })}
                  />
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
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => { e.preventDefault(); void deleteTaskType() }}
            >
              {deleting && <Loader2 className="animate-spin" />} 删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
