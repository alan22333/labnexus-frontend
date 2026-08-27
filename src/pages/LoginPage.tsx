import { useState, type FormEvent, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  ArrowRight, BookOpen, ClipboardList, FlaskConical, Loader2, Lock, MessageSquareText, Users,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const FEATURES = [
  { icon: MessageSquareText, title: "科研朋友圈", desc: "公开笔记即帖子,点赞评论,组内动态一目了然" },
  { icon: BookOpen, title: "知识库", desc: "文献 PDF、链接、笔记统一入库,标签检索不丢失" },
  { icon: ClipboardList, title: "进度监督", desc: "任务看板 + 里程碑 + 状态机,告别拖延" },
]

type Mode = "login" | "register"

export function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>("login")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  // 登录表单
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  // 注册表单
  const [inviteCode, setInviteCode] = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [regPassword, setRegPassword] = useState("")

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await login(username.trim(), password)
      toast.success("欢迎回来!")
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setError("")
    setBusy(true)
    try {
      await register(inviteCode.trim(), regUsername.trim(), displayName.trim(), regPassword)
      toast.success("注册成功,已自动登录")
      navigate("/", { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ===== 左栏:品牌与视觉 ===== */}
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-sky-500 p-10 text-white lg:flex xl:p-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-24 size-[26rem] rounded-full bg-sky-300/20 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
        </div>

        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-white/15 shadow-lg backdrop-blur-sm">
              <FlaskConical className="size-5.5 text-white" />
            </span>
            <span className="text-lg font-bold tracking-tight">LabNexus</span>
          </div>
        </div>

        <div className="relative max-w-md">
          <h1 className="text-3xl leading-tight font-bold tracking-tight xl:text-4xl">
            课题组自己的
            <br />
            科研协作平台
          </h1>
          <p className="mt-4 text-sm leading-6 text-blue-100/90 xl:text-base">
            科研朋友圈 · 知识库 · 进度监督
            <br />
            一个系统装下组内的文献、笔记、帖子与任务
          </p>

          <div className="mt-10 space-y-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <Icon className="size-4.5 text-white" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-blue-100/80">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-2 text-xs text-blue-100/70">
          <Users className="size-4" />
          10 人以内课题组 · 私有部署 · 邀请制加入
        </div>
      </aside>

      {/* ===== 右栏:登录/注册卡片 ===== */}
      <main className="flex min-h-screen flex-col items-center justify-center bg-muted/40 px-4 py-10 sm:px-6">
        {/* 移动端品牌头(桌面隐藏) */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 shadow-lg shadow-blue-500/25">
            <FlaskConical className="size-7 text-white" />
          </span>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">LabNexus</h1>
            <p className="mt-1 text-sm text-muted-foreground">课题组内部社区平台</p>
          </div>
        </div>

        <Card className="w-full max-w-md shadow-xl">
          {/* 标题行 + 紧凑切换(显式 flex,避免重叠) */}
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <CardTitle className="text-lg leading-tight">
                  {mode === "login" ? "欢迎回来" : "加入课题组"}
                </CardTitle>
                <CardDescription className="mt-1 truncate">
                  {mode === "login" ? "登录你的课题组空间" : "凭邀请码注册,注册即登录"}
                </CardDescription>
              </div>
              <ModeSwitch mode={mode} onChange={setMode} />
            </div>
          </CardHeader>
          <Separator />
          <CardContent className="pt-5">
            {mode === "login" ? (
              <form onSubmit={handleLogin} className="space-y-5">
                <Field label="用户名" htmlFor="username">
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="请输入用户名"
                    autoComplete="username"
                    className="h-10"
                    required
                  />
                </Field>
                <Field label="密码" htmlFor="password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      className="h-10 pl-9"
                      required
                    />
                  </div>
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="h-10 w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  登录
                </Button>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-5">
                <Field label="邀请码" htmlFor="invite_code">
                  <Input
                    id="invite_code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="管理员发放的邀请码"
                    className="h-10"
                    required
                  />
                </Field>
                <Field label="用户名" htmlFor="reg_username">
                  <Input
                    id="reg_username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="登录用,唯一"
                    autoComplete="username"
                    className="h-10"
                    required
                  />
                </Field>
                <Field label="昵称" htmlFor="display_name">
                  <Input
                    id="display_name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="组内显示的名称"
                    className="h-10"
                    required
                  />
                </Field>
                <Field label="密码" htmlFor="reg_password">
                  <div className="relative">
                    <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="reg_password"
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="至少 8 位"
                      autoComplete="new-password"
                      className="h-10 pl-9"
                      required
                    />
                  </div>
                </Field>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" className="h-10 w-full" disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                  注册并登录
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          LabNexus · 仅供课题组内部使用
        </p>
      </main>
    </div>
  )
}

/* 表单字段:标签 + 内容 */
function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  )
}

/* 紧凑的登录/注册切换(自绘分段按钮,无 Tabs 依赖) */
function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div className="flex shrink-0 items-center rounded-full bg-muted p-0.5" role="tablist">
      {(
        [
          ["login", "登录"],
          ["register", "注册"],
        ] as [Mode, string][]
      ).map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            mode === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
