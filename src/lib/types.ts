// LabNexus 前端类型定义 —— 与后端 docs/api-contract.md 对齐(契约先行)

export type Role = "admin" | "supervisor" | "student"

export interface User {
  id: string
  username: string
  display_name: string
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Author {
  id: string
  display_name: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

export interface Folder {
  id: string
  name: string
  parent_id: string | null
  sort_order: number
  children?: Folder[]
}

export type Visibility = "private" | "public"

export interface Document {
  id: string
  title: string
  content: string
  visibility: Visibility
  pinned: boolean
  folder_id: string | null
  author: Author
  author_id?: string
  tags: Tag[]
  reactions_count: number
  comments_count: number
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  content: string
  reply_to_id: string | null
  author: Author
  author_id?: string
  created_at: string
}

export type ResourceType = "link" | "file"

export interface Resource {
  id: string
  type: ResourceType
  title: string
  description: string
  url?: string
  original_name?: string
  mime_type?: string
  file_size?: number
  preview: { supported: boolean; type?: string; url?: string }
  download_url?: string
  uploader: Author
  uploader_id?: string
  tags: Tag[]
  created_at: string
  updated_at: string
}

export type ProjectStatus = "active" | "done"

export interface Project {
  id: string
  name: string
  description: string
  status: ProjectStatus
  owner: Author
  owner_id?: string
  created_at: string
}

export interface ProjectMember {
  user: Author
  role: string
  project_id?: string
  user_id?: string
}

export interface Milestone {
  id: string
  name: string
  due_date: string | null
  completed_at: string | null
  project_id?: string
  created_at?: string
}

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done"
export type TaskPriority = "high" | "medium" | "low"

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  due_date: string | null
  milestone_id: string | null
  assignee: Author | null
  assignee_id?: string
  project_id?: string
  created_at: string
  updated_at: string
}

// 后端 GET /projects/:id 返回 {project: ProjectView},ProjectView 为平铺结构:
// 项目字段 + owner + members + milestones + tasks(见后端 internal/project/service.go)
export interface ProjectDetail {
  id: string
  name: string
  description: string
  status: ProjectStatus
  owner: Author
  owner_id?: string
  created_at: string
  updated_at?: string
  members: ProjectMember[]
  milestones: Milestone[]
  tasks: Task[]
}

export interface Pagination {
  page: number
  page_size: number
  total: number
}

export interface SearchResults {
  documents: Document[]
  resources: Resource[]
  tasks: Task[]
}

export interface SpaceResponse {
  space: { id: string; name: string }
  folders: Folder[]
}

