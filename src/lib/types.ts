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


// ============ 经费管理 F10(与 api-contract.md §F10 对齐) ============
// 金额一律以「分」(int64)传输/存储,展示转元(见 format.ts fen2yuan)

export type FinanceBatchStatus = "active" | "done"
export type FinanceItemStatus = "pending" | "partial" | "done"
export type FinanceTxType = "income" | "expense"
export type FinanceCategory = "turnover" | "supplement" | "labor" | "other"

export interface FinanceBatch {
  id: string
  name: string
  status: FinanceBatchStatus
  note: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface BatchSummary {
  item_count: number
  total_payroll: number
  total_should_return: number
  total_returned: number
  total_unreturned: number
}

export interface FinanceParticipant {
  id: string
  name: string
  student_no: string
  note: string
  created_at: string
}

export interface FinanceSubmission {
  id: string
  item_id: string
  amount: number
  date: string
  note: string
  operator_id: string
  created_at: string
}

export interface FinanceItem {
  id: string
  batch_id: string
  participant_id: string
  date: string
  payroll_amount: number
  tax_amount: number
  tip_amount: number
  should_return: number
  returned: number
  note: string
  created_by: string
  created_at: string
  updated_at: string
  participant: FinanceParticipant
  submissions: FinanceSubmission[]
  unreturned: number
  status: FinanceItemStatus
}

export type FinanceBatchListItem = FinanceBatch & { summary: BatchSummary }

export interface FinanceBatchDetail extends FinanceBatch {
  summary: BatchSummary
  items: FinanceItem[]
}

export interface FinanceTransaction {
  id: string
  account_id: string
  type: FinanceTxType
  amount: number
  category: FinanceCategory
  related_type: string
  related_id: string | null
  note: string
  occurred_at: string
  operator_id: string
  created_at: string
  operator: User
}

export interface FinanceLedger {
  balance: number
  transactions: FinanceTransaction[]
}

export interface ParticipantStat extends FinanceParticipant {
  total_items: number
  total_should_return: number
  total_returned: number
}

export interface FinanceBill {
  batch_name: string
  date: string
  payroll_amount: number
  should_return: number
  returned: number
  unreturned: number
  note: string
}

export interface ImportRow {
  name: string
  student_no: string
  date: string
  payroll_amount: number
  tax_amount: number
  tip_amount: number
  note: string
}

export interface ImportPreview {
  preview_id: string
  valid_rows: ImportRow[]
  error_rows: string[]
  valid_count: number
  error_count: number
}
