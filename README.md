# LabNexus Frontend

LabNexus 课题组平台的前端仓库(独立开发)。

## 项目背景

LabNexus 是一个 10 人以内高校课题组内部使用的科研协作平台:科研朋友圈 + 知识库 + 进度监督。

- 后端仓库:`https://github.com/alan22333/labnexus`(Go + Gin + GORM + Postgres + Redis)
- 前端技术栈:React + Vite + Tailwind(正式版;阶段 1 验证期后端内置了纯 HTML/JS 外壳作为参考实现)
- API 契约:见后端仓库 `docs/api-contract.md`(**前端按契约开发,改接口先改契约**)

## 开发约定

- 阶段 1 的纯 HTML/JS 前端位于后端仓库 `labnexus/web/`,可作为**参考实现**(页面交互、字段命名、接口调用方式)
- 本仓库为正式前端,采用 React + Vite + Tailwind,前后端分离
- 开发前先读后端仓库的 `AGENTS.md` 与 `docs/api-contract.md`
- 每完成一个功能,按后端契约做联调,并通过后端的手工验收清单(`docs/manual-acceptance.md`)

## 快速开始(待朋友完成初始化后补充)

```bash
npm install
npm run dev
```

> 开发环境后端默认运行在 `http://localhost:8080`,前端通过 Vite 代理转发 `/api`。

## 目录结构(待补充)

## License

私有项目,课题组内部使用。
