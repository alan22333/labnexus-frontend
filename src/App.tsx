import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"
import { Loader2 } from "lucide-react"

import { AppLayout } from "@/components/layout/AppLayout"

const page = <T,>(loader: () => Promise<{ [K in keyof T]: unknown }>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name as keyof typeof m] as React.ComponentType })))

const LoginPage = page(() => import("@/pages/LoginPage"), "LoginPage")
const FeedPage = page(() => import("@/pages/FeedPage"), "FeedPage")
const SpacePage = page(() => import("@/pages/SpacePage"), "SpacePage")
const ResourcesPage = page(() => import("@/pages/ResourcesPage"), "ResourcesPage")
const ProjectsPage = page(() => import("@/pages/ProjectsPage"), "ProjectsPage")
const ProjectDetailPage = page(() => import("@/pages/ProjectDetailPage"), "ProjectDetailPage")
const SearchPage = page(() => import("@/pages/SearchPage"), "SearchPage")
const FinancePage = page(() => import("@/pages/FinancePage"), "FinancePage")
const AdminPage = page(() => import("@/pages/AdminPage"), "AdminPage")
const DocumentReaderPage = page(() => import("@/pages/DocumentReaderPage"), "DocumentReaderPage")
const ScoutOverviewPage = page(() => import("@/pages/ScoutOverviewPage"), "ScoutOverviewPage")
const ScoutConnectionsPage = page(() => import("@/pages/ScoutConnectionsPage"), "ScoutConnectionsPage")
const ScoutResearchPage = page(() => import("@/pages/ScoutResearchPage"), "ScoutResearchPage")

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="size-6 animate-spin text-primary" />
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<FeedPage />} />
          <Route path="/space" element={<SpacePage />} />
          <Route path="/resources" element={<ResourcesPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/documents/:id" element={<DocumentReaderPage />} />
          <Route path="/scout" element={<ScoutOverviewPage />} />
          <Route path="/scout/connections" element={<ScoutConnectionsPage />} />
          <Route path="/scout/research" element={<ScoutResearchPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
