import { useEffect, useRef, useState, type FormEvent } from "react"
import { Link, NavLink, useNavigate } from "react-router-dom"
import {
  BookOpen, ChevronRight, ClipboardList, FileText, FlaskConical, FolderKanban,
  LayoutGrid, Link2, Loader2, LogOut, Menu, Moon, Search, Settings, Sun,
  UserRound, Wallet,
} from "lucide-react"
import { useTheme } from "next-themes"
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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/use-auth"
import { authApi, searchApi } from "@/lib/api"
import type { SearchResults } from "@/lib/types"
import { cn } from "@/lib/utils"

const NAV = [
  { to: "/", label: "信息流", icon: LayoutGrid, end: true },
  { to: "/resources", label: "资源库", icon: FolderKanban, end: false },
  { to: "/projects", label: "项目管理", icon: ClipboardList, end: false },
  { to: "/finance", label: "经费管理", icon: Wallet, end: false, finOnly: true },
  { to: "/admin", label: "后台管理", icon: Settings, end: false, adminOnly: true },
]

const ROLE_LABEL: Record<string, string> = {
  admin: "管理员",
  supervisor: "导师",
  student: "学生",
}

function visibleNavs(role?: string) {
  const canFinance = role === "admin" || role === "supervisor"
  return NAV.filter((n) =>
    (!("finOnly" in n) || canFinance) && (!("adminOnly" in n) || role === "admin")
  )
}

function NavLinks({ navs, onNavigate }: { navs: typeof NAV; onNavigate?: () => void }) {
  return (
    <div className="space-y-1">
      {navs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-primary/[0.08] font-semibold text-primary before:absolute before:top-1.5 before:bottom-1.5 before:-left-2 before:w-[3px] before:rounded-full before:bg-primary"
                : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            )
          }
        >
          <Icon className="size-4.5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  )
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("text-muted-foreground", className)}
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
      title={dark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

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
    <div ref={boxRef} className="relative w-full">
      <form onSubmit={submit}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => results && setOpen(true)}
            placeholder="搜索文档 / 资源 / 任务…"
            className="h-9 bg-card pl-8 pr-8 shadow-xs"
          />
          {searching && (
            <Loader2 className="absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
      </form>

      {open && q.trim() && (
        <div className="absolute top-full left-0 z-50 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-lg border bg-popover p-2 shadow-raised">
          {total === 0 && !searching ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">没有找到与「{q}」相关的内容</p>
          ) : (
            <div className="max-h-[24rem] space-y-3 overflow-y-auto p-1">
              <ResultGroup
                icon={<FileText className="size-3.5 text-primary" />}
                label="文档"
                count={docs.length}
                items={docs.slice(0, 4).map((d) => ({ id: d.id, title: d.title, sub: `${d.author?.display_name ?? "?"} · ${d.visibility === "public" ? "公开" : "私有"}` }))}
                onMore={() => { setOpen(false); navigate(`/search?q=${encodeURIComponent(q)}`) }}
              />
              <ResultGroup
                icon={<Link2 className="size-3.5 text-success" />}
                label="资源"
                count={ress.length}
                items={ress.slice(0, 4).map((r) => ({ id: r.id, title: r.title, sub: `类型:${r.type === "link" ? "链接" : "文件"}` }))}
                onMore={() => { setOpen(false); navigate("/resources") }}
              />
              <ResultGroup
                icon={<ClipboardList className="size-3.5 text-warning" />}
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

function UserMenu({
  compact = false,
  align = "end",
  side = "bottom",
}: {
  compact?: boolean
  align?: "start" | "center" | "end"
  side?: "top" | "right" | "bottom" | "left"
}) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [profileOpen, setProfileOpen] = useState(false)

  async function handleLogout() {
    await logout()
    toast.success("已退出登录")
    navigate("/login", { replace: true })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center rounded-md outline-none transition-colors hover:bg-muted",
              compact ? "p-0.5" : "w-full gap-3 p-2 text-left"
            )}
          >
            <Avatar name={user?.display_name ?? "?"} id={user?.id} src={user?.avatar_url} className="size-8" />
            {!compact && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{user?.display_name}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{user?.username}</span>
                </span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} side={side} className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">{user?.display_name}</span>
              <span className="text-xs font-normal text-muted-foreground">@{user?.username}</span>
              <Badge className="mt-1 w-fit" variant="secondary">
                {ROLE_LABEL[user?.role ?? ""] ?? user?.role}
              </Badge>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/space")}>
            <BookOpen />
            我的空间
          </DropdownMenuItem>
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
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  )
}

/** 桌面端左侧主导航 */
export function AppSidebar() {
  const { user } = useAuth()
  const navs = visibleNavs(user?.role)

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card/95 shadow-sm backdrop-blur md:flex">
      <div className="flex h-16 shrink-0 items-center border-b px-5">
        <Link to="/" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-sm">
            <FlaskConical className="size-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-tight">LabNexus</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          工作台
        </p>
        <NavLinks navs={navs} />
      </div>

      <div className="border-t p-3">
        <UserMenu align="start" side="top" />
      </div>
    </aside>
  )
}

/** 主内容区顶部栏:移动端导航、搜索与主题切换 */
export function TopBar() {
  const { user } = useAuth()
  const navs = visibleNavs(user?.role)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl">
      <div className="flex h-14 items-center gap-2 px-3 sm:px-4 md:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="打开导航">
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 gap-0 p-0">
            <SheetTitle className="sr-only">主导航</SheetTitle>
            <div className="flex h-16 shrink-0 items-center border-b px-5">
              <Link to="/" onClick={() => setMobileOpen(false)} className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary shadow-sm">
                  <FlaskConical className="size-5 text-white" />
                </span>
                <span className="text-lg font-bold tracking-tight">LabNexus</span>
              </Link>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-5">
              <NavLinks navs={navs} onNavigate={() => setMobileOpen(false)} />
            </nav>
            <div className="mt-auto border-t p-3">
              <div className="mb-2 flex items-center justify-between rounded-lg bg-muted/60 px-3 py-1.5">
                <span className="text-sm text-muted-foreground">外观</span>
                <ThemeToggle />
              </div>
              <UserMenu />
            </div>
          </SheetContent>
        </Sheet>

        <Link to="/" className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary shadow-sm md:hidden">
          <FlaskConical className="size-4.5 text-white" />
        </Link>

        <div className="min-w-0 flex-1 md:mx-auto md:max-w-md">
          <SearchBox />
        </div>

        <ThemeToggle className="hidden md:inline-flex" />
        <div className="md:hidden">
          <UserMenu compact />
        </div>
      </div>
    </header>
  )
}
