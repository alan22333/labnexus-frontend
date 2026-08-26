import { Navigate, Outlet } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { TopBar } from "@/components/layout/TopBar"
import { useAuth } from "@/hooks/use-auth"

/** 受保护的主布局:未登录跳转登录页 */
export function AppLayout() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex min-h-screen flex-col bg-muted/40">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        LabNexus · 课题组内部平台
      </footer>
    </div>
  )
}
