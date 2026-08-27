# LabNexus Frontend

LabNexus 课题组平台的前端仓库(独立开发)。

## 项目背景

LabNexus 是一个 10 人以内高校课题组内部使用的科研协作平台:科研朋友圈 + 知识库 + 进度监督。

- 后端仓库:`https://github.com/alan22333/labnexus`(Go + Gin + GORM + Postgres + Redis)
- API 契约:见后端仓库 `docs/api-contract.md`(**前端按契约开发,改接口先改契约**)

## 技术栈(已定稿,勿改)

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **React 19** | 正式前端 |
| 构建 | **Vite** | 开发服务器 + 构建(路由级分包) |
| 样式 | **Tailwind CSS v4** | 原子化 CSS |
| UI 组件库 | **shadcn/ui**(Radix 基座) | 源码进项目,可直接定制 |
| 路由 | **react-router-dom v7** | 页面路由 |
| 通知 | **sonner** | toast 提示 |

> 为什么选 shadcn/ui(已确定,2026-08-25):与 Tailwind 零冲突、视觉现代(Vercel 风格)、组件源码复制进项目可直接读源码定制、按需打包体积轻。备选已评估:Ant Design(偏企业后台,不采用)、Mantine、MUI(均不采用)。

## 快速开始

前置:后端已启动(`make up` + `make run`,默认 `http://localhost:8080`)。

```bash
npm install
npm run dev        # http://localhost:5173,/api 代理到后端 :8080
npm run build      # 生产构建(tsc 类型检查 + vite build)
npm run lint       # oxlint
```

> 开发环境后端默认运行在 `http://localhost:8080`,前端通过 Vite 代理转发 `/api`(见 `vite.config.ts`)。

### 登录与邀请码

注册需要邀请码。后端管理端未实现时,用 SQL 插入:

```bash
docker exec labnexus-postgres psql -U labnexus -d labnexus -c \
  "INSERT INTO invite_codes (id, code, created_by) VALUES
   (gen_random_uuid(),'YOUR-CODE','00000000-0000-0000-0000-000000000000');"
```

## 功能页面

| 路由 | 页面 | 功能 |
|---|---|---|
| `/login` | 登录/注册 | 邀请码注册(注册即登录)、JWT 自动刷新 |
| `/` | 信息流 | 公开帖时间线(最新/热门)、点赞、评论、发帖/写笔记 |
| `/space` | 我的空间 | 目录树(建/改/删)、文档列表、新建/编辑/删除(可见性切换) |
| `/resources` | 资源库 | 链接/文件、预览/下载(带鉴权 blob)、标签、筛选、分页 |
| `/projects` | 项目 | 项目列表、创建 |
| `/projects/:id` | 项目详情 | 看板(4 列状态机)、成员、里程碑、任务创建/流转 |
| `/tags` | 标签 | 创建标签(带颜色)、标签内容页(文档+资源) |
| `/search` | 搜索 | 跨文档/资源/任务聚合结果 |

## 目录结构

```
labnexus-frontend/
├── index.html
├── vite.config.ts          # Tailwind 插件 + /api 代理 + @ 别名
├── src/
│   ├── main.tsx            # 入口:Router + Theme + Auth + Tooltip
│   ├── App.tsx             # 路由(懒加载分包)
│   ├── index.css           # Tailwind v4 + shadcn 主题变量(主色 #3b82f6)
│   ├── lib/
│   │   ├── api.ts          # API 客户端(401 自动 refresh、blob 下载)
│   │   ├── types.ts        # 与后端 api-contract.md 对齐的类型
│   │   └── format.ts       # 时间/大小格式化、头像色
│   ├── hooks/use-auth.tsx  # 认证上下文
│   ├── components/
│   │   ├── ui/             # shadcn 组件(源码,可按需改)
│   │   ├── layout/         # 顶栏(搜索/用户菜单)+ 主布局
│   │   ├── common/         # Avatar / TagBadges
│   │   ├── documents/      # 文档卡片/编辑器/评论/详情
│   │   ├── resources/      # 资源创建对话框
│   │   └── projects/       # 任务对话框
│   └── pages/              # 页面(登录/信息流/空间/资源/项目/标签/搜索)
```

## 开发约定

- 阶段 1 的纯 HTML/JS 前端位于后端仓库 `labnexus/web/`,作为**参考实现**(交互/字段命名/接口调用)
- 开发前先读后端仓库的 `AGENTS.md` 与 `docs/api-contract.md`
- 每完成一个功能,按后端契约联调,并通过后端的手工验收清单(`docs/manual-acceptance.md`)
- 主题色主蓝 `#3b82f6`,字体系统中文栈,均已在 `src/index.css` 配置

## License

私有项目,课题组内部使用。
