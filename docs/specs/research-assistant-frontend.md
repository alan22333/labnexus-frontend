# 调研助手前端接入规格

## 1. 背景与目标

Research Scout 已具备 Zotero 连接、同步、覆盖统计等控制面能力，并已实现 LabNexus HS256 Bearer JWT 身份桥（ADR-018，非 OIDC，per-user workspace）。本规格定义 LabNexus 正式前端中的「调研助手」页面，目标是在不修改 LabNexus 业务库和权限模型的前提下，复用 LabNexus 登录身份、完成可视化入口和可联调切片。

页面位于 `labnexus-frontend`，Research Scout 仓库中的 `web/` 仅作为交互参考，不作为正式交付位置。

## 2. 范围

### 2.1 本切片包含

- 顶栏新增「调研助手」入口，登录后可见。
- `/scout`：概览、当前身份、Zotero 连接摘要、文库覆盖。
- `/scout/connections`：连接列表、Zotero OAuth 授权、验证、同步、撤销、查看 coverage。
- `/scout/research`：调研工作台。研究项目增删改、检索范围（整库 / 指定 collection）、三种检索模式（我的文库 / 查缺补漏 / 全景调研）、多轮提问与会话历史、证据分层简报（导出 JSON / BibTeX / CSV）、点赞点踩反馈、检索过程记录、证据不足降级提示。
- 通过 `/api/scout/*` 调用 Research Scout API，并携带 LabNexus Bearer 令牌；开发环境由 Vite 代理到独立服务。
- 401 时用 `ln_refresh` Cookie 刷新一次访问令牌后重放请求，刷新失败再引导重新登录。
- API 错误、加载中、空状态和不可用状态显式展示，不把失败误报为空数据。
- `metadata_only` 明确标注「不作为结论证据」，`local_only_warning` 明确提示本地-only 缺口。

### 2.2 本切片不包含

- 不把 Research Scout 数据写入 LabNexus 数据库。
- 不在前端持久化 Zotero 密钥；Zotero 授权走服务端 OAuth 1.0a 回调，浏览器只负责跳转。
- 不实现分享、公共库、Zotero 写回、批注/笔记索引与手动 PDF 上传。
- 不在前端做检索编排或证据判定；一切以服务端返回的 Brief / Evidence / Gap 为准。
- 不在 LabNexus 后端新增转发接口；生产部署由网关统一提供 `/api/scout/*`。

## 3. 接口与配置

- 默认 API 基址：`/api/scout`，可由 `VITE_SCOUT_API_BASE_URL` 覆盖。
- 开发代理：`/api/scout/*` → Research Scout `/api/v1/*`，默认目标 `http://localhost:8081`；
  可用 `VITE_SCOUT_PROXY_TARGET` 覆盖代理目标（仅影响开发代理，不影响生产网关路由）。
- Research Scout 返回错误模型：`{error:{code,message,retryable,request_id,details}}`。
- 列表接口同时兼容裸数组和 `{items,meta:{next_cursor}}` / `{items,next_cursor}`。
- 身份：请求头 `Authorization: Bearer <ln_token>`；Research Scout 侧 `IDENTITY_PROVIDER=labnexus`。
- Zotero OAuth：`POST /zotero/oauth/start` 返回 `authorization_url`，前端跳转到该地址；回调由服务端处理并重定向回 `/scout/connections?zotero=connected|error`。

## 4. 验收标准

| ID | Given / When / Then |
|---|---|
| AC-SF1 | 登录用户可以访问 `/scout` 和 `/scout/connections`，未登录用户由既有 `AppLayout` 守护。 |
| AC-SF2 | 顶栏显示「调研助手」，点击后进入 `/scout`，子路由保持导航选中。 |
| AC-SF3 | 所有 Research Scout 请求携带 LabNexus Bearer 令牌；401 时最多刷新一次访问令牌并重放请求。 |
| AC-SF4 | 点击「连接 Zotero」跳转 Zotero 授权页；回调后页面按 `zotero=connected|error` 展示结果，界面不出现也不回显任何密钥。 |
| AC-SF5 | Coverage 有 `metadata_only > 0` 时显示「仅元数据 · 不作为结论证据」。 |
| AC-SF6 | Coverage `local_only_warning=true` 时显示「本地-only」提示。 |
| AC-SF7 | 连接或 coverage 请求失败时显示错误态，不展示误导性的空列表。 |
| AC-SF8 | 连接状态同时用中文文本和颜色表达。 |
| AC-SF9 | `/scout/research` 可加载项目、检索范围与历史会话；切换项目会重置会话并刷新范围。 |
| AC-SF10 | 提问时按所选模式与范围提交；范围未保存或为空时阻止提交并给出明确原因。 |
| AC-SF11 | 简报区分正常回答与「证据不足，暂不下结论」；后者不渲染发现与引用区块。 |
| AC-SF12 | 证据按 `personal_fulltext > structured_abstract > web_context` 分层展示；来源状态逐条可见。 |
| AC-SF13 | 含中日韩文字的提问在提交前给出「中文长句术语匹配偏保守」提示。 |
| AC-SF14 | 简报可导出 JSON / BibTeX / CSV；导出失败以 toast 报错，不静默失败。 |

## 5. 验证计划

- `npm test -- --run`
- `npm run lint`
- `npm run build`
- 启动 LabNexus API、Research Scout API 和 LabNexus 前端后，手工检查 `/scout`、`/scout/connections` 与 `/scout/research`（英文提问走通完整简报，中文提问确认降级提示）。

## 6. 风险与待确认

- Research Scout 以 `labnexus:<uid>` 作为 `actor_id`/`workspace_id`；`LAB_NEXUS_JWT_SECRET` 必须与 LabNexus `JWT_SECRET` 一致，密钥轮换需两边同步发布。
- 生产环境的 `/api/scout/*` 路由由部署网关负责，不能依赖 Vite 代理。
- Research Scout 当前接口仍处于独立仓库，契约漂移需要在正式联调前同步 OpenAPI。
