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
>
> 「调研助手」走独立服务:`/api/scout/*` 代理到 Research Scout(默认 `http://localhost:8081`,重写为 `/api/v1/*`);
> 可用 `VITE_SCOUT_API_BASE_URL` 覆盖前端 API 基址,用 `VITE_SCOUT_PROXY_TARGET` 覆盖开发代理目标
> (Scout 已在其它端口时,例如 `VITE_SCOUT_PROXY_TARGET=http://localhost:8080 npm run dev`)。
> **生产环境的 `/api/scout/*` 由部署网关提供,不依赖 Vite 代理。**

### 登录与邀请码

注册需要邀请码。admin 登录后进入 `/admin` 的「邀请码」tab 生成,并可直接复制注册链接
(`/register?code=XXX`);打开该链接会自动切到注册模式并预填邀请码。

> 若还没有 admin 账号或临时需要,可用 SQL 兜底:

```bash
docker exec labnexus-postgres psql -U labnexus -d labnexus -c \
  "INSERT INTO invite_codes (id, code, created_by) VALUES
   (gen_random_uuid(),'YOUR-CODE','00000000-0000-0000-0000-000000000000');"
```

## 功能页面

| 路由 | 页面 | 功能 |
|---|---|---|
| `/login` | 登录/注册 | 邀请码注册(注册即登录)、JWT 自动刷新 |
| `/register` | 注册 | 等价 `/login`;支持 `?code=XXX` 预填邀请码并自动切注册模式 |
| `/` | 信息流 | 公开帖时间线(最新/热门)、点赞、评论、发帖/写笔记 |
| `/space` | 我的空间 | 目录树(建/改/删)、文档列表、新建/编辑/删除(可见性切换) |
| `/resources` | 资源库 | 链接/文件、预览/下载(带鉴权 blob)、标签、筛选、分页 |
| `/projects` | 项目 | 项目列表(进度条/逾期提示)、创建 |
| `/projects/:id` | 项目详情 | 看板(4 列状态机)、成员(候选下拉添加)、里程碑、任务创建/流转/类型/逾期高亮、进度统计 |
| `/tags` | 标签 | 创建标签(带颜色)、标签内容页(文档+资源) |
| `/search` | 搜索 | 跨文档/资源/任务聚合结果 |
| `/finance` | 经费(仅 admin/导师) | 资金池、批次/明细、Excel 导入、收款、参与同学(参考实现见后端 labnexus/web 的 Finance 模块) |
| `/admin` | **管理后台**(仅 admin) | 单页三 tab:成员管理(列表/搜索/改角色,防锁死提示)、邀请码管理(生成/列表/撤销/复制注册链接)、任务类型管理(CRUD/停用/删除/排序)。顶栏仅 admin 显示入口 |
| `/scout` | **调研助手**(登录可见) | Research Scout 概览:LabNexus 当前身份、Zotero 连接摘要/状态、文库覆盖(coverage)、无连接引导 |
| `/scout/connections` | 调研助手 · 连接 | Zotero 连接列表、创建(凭据不回显)、验证、同步、撤销、查看覆盖与 collection 数量;失败态显式提示 |
| `/scout/research` | 调研助手 · 工作台 | 研究项目(增删改)、检索范围(整库/指定 collection)、三种检索模式(我的文库/查缺补漏/全景调研)、多轮提问与会话历史、证据分层简报(导出 JSON/BibTeX/CSV)、检索过程记录、证据不足降级提示 |

## 目录结构

```
labnexus-frontend/
├── index.html
├── vite.config.ts          # Tailwind 插件 + /api 代理 + @ 别名
├── src/
│   ├── main.tsx            # 入口:Router + Theme + Auth + Tooltip
│   ├── App.tsx             # 路由(懒加载分包)
│   ├── index.css           # Tailwind v4 + shadcn 主题变量(主色 深钴蓝 oklch(0.5 0.17 262) ≈ #285cc2)
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
│   │   ├── scout/          # 调研助手(coverage / 连接列表)
│   │   └── projects/       # 任务对话框
│   └── pages/              # 页面(登录/信息流/空间/资源/项目/标签/搜索/经费/管理后台/调研助手)
```

## 开发约定

- 阶段 1 的纯 HTML/JS 前端位于后端仓库 `labnexus/web/`,作为**参考实现**(交互/字段命名/接口调用)
- 开发前先读后端仓库的 `AGENTS.md` 与 `docs/api-contract.md`
- 每完成一个功能,按后端契约联调,并通过后端的手工验收清单(`docs/manual-acceptance.md`)
- **管理后台(/admin)**:已实现(后端契约见 `docs/specs/admin-console.md` §4 与 §8);顶栏入口复用 `/finance` 的角色过滤模式(`user.role === "admin"`)
- **调研助手(/scout)**:规格见 `docs/specs/research-assistant-frontend.md`;前端只调用 Research Scout API,不写 LabNexus 业务库;已通过 LabNexus Bearer JWT 桥接到 per-user workspace,顶栏入口对所有登录用户可见
- 主题色为深钴蓝(亮色 `oklch(0.5 0.17 262)` ≈ `#285cc2`,暗色 `oklch(0.66 0.16 262)` ≈ `#5a8ff3`),
  用 OKLCH 语义令牌定义;中性色带蓝灰调,字体系统中文栈,均已在 `src/index.css` 配置

## License

私有项目,课题组内部使用。
