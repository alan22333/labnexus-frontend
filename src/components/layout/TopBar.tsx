import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import {
  FileText, FlaskConical, FolderKanban, LayoutGrid, LogOut, Search, Tag as TagIcon,
  UserRound, Wallet, ClipboardList, BookOpen, Link2, Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Avatar } from "@/components/common/Avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/use-auth"
import { authApi, searchApi } from "@/lib/api"
import type { SearchResults } from "@/lib/types"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "信息流", icon: LayoutGrid, end: true },
  { to: "/space", label: "我的空间", icon: BookOpen, end: false },
  { to: "/resources", label: "资源库", icon: FolderKanban, end: false },
  { to: "/projects", label: "项目", icon: ClipboardList, end: false },
  { to: "/tags", label: "标签", icon: TagIcon, end: false },
  { to: "/finance", label: "经费", icon: Wallet, end: false, finOnly: true },
]

function SearchBox() {
  const navigate = useNavigate()
  const [q, setQ] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [open, setOpen] = useState(false)
  const [searching, setSearching] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!q.trim()) {
      setResults(null)
      setSearching(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchApi.run(q.trim())
        setResults(data)
        setOpen(true)
      } catch {
        setResults(null)
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  function submit(e: FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    setOpen(false)
    navigate(`/search?q=${encodeURIComponent(term)}`)
  }

  const docs = results?.documents ?? []
  const ress = results?.resources ?? []
  const tasks = results?.tasks ?? []
  const total = docs.length + ress.length + tasks.length

  return (
    <div ref={boxRef} className="relative flex-1 max-w-sm">
      <form onSubmit={submit}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="搜索文档 / 资源 / 任务…"
            className="h-8 bg-muted/60 pl-8 pr-8"
          />
          {searching && (
            <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </form>

      {open && q.trim() && (
        <div className="absolute top-full right-0 z-50 mt-2 w-[26rem] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-2 shadow-lg">
          {total === 0 && !searching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">没有找到与「{q}」相关的内容</p>
          ) : (
            <div className="max-h-[24rem] space-y-3 overflow-y-auto p-1">
              <ResultGroup
                icon={<FileText className="size-3.5 text-blue-500" />}
                label="文档"
                count={docs.length}
                items={docs.slice(0, 4).map((d) => ({ id: d.id, title: d.title, sub: `${d.author?.display_name ?? "?"} · ${d.visibility === "public" ? "公开" : "私有"}` }))}
                onMore={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(q)}`) }}
              />
              <ResultGroup
                icon={<Link2 className="size-3.5 text-emerald-500" />}
                label="资源"
                count={ress.length}
                items={ress.slice(0, 4).map((r) => ({ id: r.id, title: r.title, sub: `类型:${r.type === "link" ? "链接" : "文件"}` }))}
                onMore={() => { setOpen(false); navigate("/resources") }}
              />
              <ResultGroup
                icon={<ClipboardList className="size-3.5 text-amber-500" />}
                label="任务"
                count={tasks.length}
                items={tasks.slice(0, 4).map((t) => ({ id: t.id, title: t.title, sub: `状态:${t.status}` }))}
                onMore={() => { setOpen(false); navigate("/projects") }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ResultGroup({
  icon, label, count, items, onMore,
}: {
  icon: React.ReactNode
  label: string
  count: number
  items: { id: string; title: string; sub: string }[]
  onMore: () => void
}) {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between px-2 pb-1">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
          {icon}
          {label}
          <Badge variant="secondary" className="ml-0.5 px-1.5 py-0 text-[10px]">{count}</Badge>
        </span>
        <button type="button" onClick={onMore} className="text-xs text-primary hover:underline">
          查看全部
        </button>
      </div>
      <div className="space-y-0.5">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={onMore}
            className="flex w-full flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
          >
            <span className="line-clamp-1 text-sm font-medium">{it.title}</span>
            <span className="text-xs text-muted-foreground">{it.sub}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { user, setUser } = useAuth()
  const [displayName, setDisplayName] = useState(user?.display_name ?? "")
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setDisplayName(user?.display_name ?? "")
      setOldPassword("")
      setNewPassword("")
    }
  }, [open, user])

  async function save() {
    setBusy(true)
    try {
      const body: { display_name?: string; password?: string; old_password?: string } = {}
      if (displayName.trim() && displayName.trim() !== user?.display_name) body.display_name = displayName.trim()
      if (newPassword) {
        if (!oldPassword) {
          toast.error("修改密码需要填写当前密码")
          return
        }
        body.password = newPassword
        body.old_password = oldPassword
      }
      if (!body.display_name && !body.password) return
      const { user: updated } = await authApi.updateMe(body)
      setUser(updated)
      setOldPassword("")
      setNewPassword("")
      toast.success("资料已更新")
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>个人资料</DialogTitle>
          <DialogDescription>修改昵称或登录密码</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="pd-name">昵称</Label>
            <Input id="pd-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pd-old">当前密码</Label>
            <Input id="pd-old" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pd-new">新密码</Label>
            <Input id="pd-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="留空则不修改" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={save} disabled={busy}>{busy ? "保存中…" : "保存"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function TopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const canFinance = user?.role === "admin" || user?.role === "supervisor"
  const navs = NAV.filter((n) => !("finOnly" in n) || canFinance)
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    toast.success("已退出登录")
    navigate("/login", { replace: true })
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-sky-400 shadow-sm">
            <FlaskConical className="size-4.5 text-white" />
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:block">LabNexus</span>
        </Link>

        <nav className="ml-2 hidden items-center gap-1 md:flex">
          {navs.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchBox />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-2 rounded-full p-1 outline-none transition-colors hover:bg-muted">
                <Avatar name={user?.display_name ?? "?"} id={user?.id} src={user?.avatar_url} className="size-8" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-medium">{user?.display_name}</span>
                  <span className="text-xs font-normal text-muted-foreground">@{user?.username}</span>
                  <Badge className="mt-1 w-fit" variant="secondary">{user?.role}</Badge>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                <UserRound />
                个人资料
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                <LogOut />
                退出登录
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 移动端横向导航 */}
      <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 md:hidden">
        {navs.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "shrink-0 rounded-full px-3 py-1 text-sm font-medium",
                isActive ? "bg-primary/10 text-primary" : "text-muted-foreground"
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </header>
  )
}

