// 时间与大小格式化工具

export function timeAgo(iso: string): string {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (Number.isNaN(diff)) return ""
  const min = Math.floor(diff / 60000)
  if (min < 1) return "刚刚"
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return d.toLocaleDateString("zh-CN")
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtSize(n?: number | null): string {
  if (n == null) return ""
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`
}

// 由 id 生成稳定的头像底色(hue)
export function avatarHue(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360
  return h
}

export function initials(name: string): string {
  return (name || "?").trim().charAt(0).toUpperCase()
}

// ============ 金额(分 → 元)与日期工具(经费管理 F10) ============
// 后端金额一律以「分」(int64)传输/存储;展示转元,输入转分。

/** 分 → 元字符串(如 240000 → "2400";12345 → "123.45";-100 → "-1") */
export function fen2yuan(fen?: number | null): string {
  if (fen == null || Number.isNaN(fen)) return "0"
  const neg = fen < 0
  const abs = Math.abs(Math.round(fen))
  const yuan = Math.floor(abs / 100)
  const rem = abs % 100
  const s = rem === 0 ? String(yuan) : `${yuan}.${String(rem).padStart(2, "0").replace(/0$/, "")}`
  return neg ? `-${s}` : s
}

/** 元字符串(如 "2400" / "123.45" / "-1.5")→ 分;非法输入返回 null */
export function yuan2fen(input: string): number | null {
  const s = String(input ?? "").trim()
  if (!s) return null
  const m = s.match(/^-?(\d+)(?:\.(\d{1,2}))?$/)
  if (!m) return null
  let fen = parseInt(m[1], 10) * 100
  if (m[2]) fen += parseInt(m[2].padEnd(2, "0"), 10)
  return s.startsWith("-") ? -fen : fen
}

/** 今天的日期 YYYY-MM-DD(本地时区,不用 toISOString 以免跨天) */
export function today(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** 日期展示:兼容 "YYYY-MM-DD" 与 RFC3339,统一取前 10 位 */
export function fmtDate(d?: string | null): string {
  if (!d) return ""
  return String(d).slice(0, 10)
}
