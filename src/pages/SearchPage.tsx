import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { ClipboardList, FileText, Link2, Loader2, Search } from "lucide-react"

import { DocumentDetailDialog } from "@/components/documents/DocumentDetailDialog"
import { Card } from "@/components/ui/card"
import { searchApi } from "@/lib/api"
import type { SearchResults } from "@/lib/types"

export function SearchPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const q = params.get("q") ?? ""
  const [data, setData] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [docId, setDocId] = useState<string | null>(null)
  const [docOpen, setDocOpen] = useState(false)

  useEffect(() => {
    if (!q) return
    let cancelled = false
    setLoading(true)
    setError("")
    searchApi
      .run(q)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "搜索失败")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [q])

  const docs = data?.documents ?? []
  const ress = data?.resources ?? []
  const tasks = data?.tasks ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <Search className="size-5 text-primary" />
          搜索:「{q}」
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          共 {docs.length + ress.length + tasks.length} 条结果 · 文档 {docs.length} · 资源 {ress.length} · 任务 {tasks.length}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed bg-background py-16 text-center text-sm text-destructive">
          {error}
        </div>
      ) : docs.length + ress.length + tasks.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-background py-20 text-center">
          <p className="text-3xl">🔍</p>
          <p className="mt-2 text-sm text-muted-foreground">没有找到相关内容,换个关键词试试</p>
        </div>
      ) : (
        <div className="space-y-6">
          <ResultSection
            icon={<FileText className="size-4 text-blue-500" />}
            title="文档"
            count={docs.length}
            empty={docs.length === 0}
          >
            {docs.map((d) => (
              <button key={d.id} type="button" onClick={() => { setDocId(d.id); setDocOpen(true) }} className="block w-full text-left">
                <Card className="p-3 transition-colors hover:bg-muted/50">
                  <p className="text-sm font-medium">{d.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d.author?.display_name} · {d.visibility === "public" ? "公开" : "私有"}
                  </p>
                </Card>
              </button>
            ))}
          </ResultSection>

          <ResultSection
            icon={<Link2 className="size-4 text-emerald-500" />}
            title="资源"
            count={ress.length}
            empty={ress.length === 0}
          >
            {ress.map((r) => (
              <button key={r.id} type="button" onClick={() => navigate("/resources")} className="block w-full text-left">
                <Card className="p-3 transition-colors hover:bg-muted/50">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">类型:{r.type === "link" ? "链接" : "文件"} · {r.uploader?.display_name}</p>
                </Card>
              </button>
            ))}
          </ResultSection>

          <ResultSection
            icon={<ClipboardList className="size-4 text-amber-500" />}
            title="任务"
            count={tasks.length}
            empty={tasks.length === 0}
          >
            {tasks.map((t) => (
              <button
                key={t.id}
                type="button"
                disabled={!t.project_id}
                onClick={() => t.project_id && navigate(`/projects/${t.project_id}`)}
                className="block w-full text-left disabled:cursor-default"
              >
                <Card className="p-3 transition-colors hover:bg-muted/50">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">状态:{t.status}</p>
                </Card>
              </button>
            ))}
          </ResultSection>
        </div>
      )}

      <DocumentDetailDialog documentId={docId} open={docOpen} onOpenChange={setDocOpen} />
    </div>
  )
}

function ResultSection({
  icon, title, count, empty, children,
}: {
  icon: React.ReactNode
  title: string
  count: number
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        {icon}
        {title}
        <span className="text-muted-foreground">({count})</span>
      </h2>
      {empty ? (
        <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">无</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </section>
  )
}

