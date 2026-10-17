import type { Role } from "@/lib/types"

/**
 * 开发/演示账号清单(与后端 internal/demo/demo.go 的种子数据保持一致)。
 *
 * 仅用于本地开发与演示;是否在页面上展示由 `showDemoAccounts` 控制,
 * 生产构建默认不展示,避免把测试口令带到线上。
 */
export interface DemoAccount {
  username: string
  password: string
  role: Role
  roleLabel: string
  name: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: "test_admin", password: "Test@123456", role: "admin", roleLabel: "管理员", name: "测试管理员" },
  { username: "supervisor", password: "Demo@123456", role: "supervisor", roleLabel: "导师", name: "李文博" },
  { username: "student1", password: "Demo@123456", role: "student", roleLabel: "学生", name: "张伟" },
  { username: "student2", password: "Demo@123456", role: "student", roleLabel: "学生", name: "王芳" },
  { username: "student3", password: "Demo@123456", role: "student", roleLabel: "学生", name: "陈浩" },
  { username: "student4", password: "Demo@123456", role: "student", roleLabel: "学生", name: "刘洋" },
]

/**
 * 是否展示演示账号:
 * - 开发环境(import.meta.env.DEV)恒展示;
 * - 生产构建需显式设置 `VITE_SHOW_DEMO_ACCOUNTS=true` 才展示(如演示服务器)。
 */
export const showDemoAccounts =
  import.meta.env.DEV || import.meta.env.VITE_SHOW_DEMO_ACCOUNTS === "true"
