# LabNexus Frontend

LabNexus 课题组平台的前端仓库(独立开发)。

## 项目背景

LabNexus 是一个 10 人以内高校课题组内部使用的科研协作平台:科研朋友圈 + 知识库 + 进度监督。

- 后端仓库:`https://github.com/alan22333/labnexus`(Go + Gin + GORM + Postgres + Redis)
- API 契约:见后端仓库 `docs/api-contract.md`(**前端按契约开发,改接口先改契约**)

## 技术栈(已定稿,勿改)

| 层 | 选型 | 说明 |
|---|---|---|
| 框架 | **React** | 正式前端 |
| 构建 | **Vite** | 开发服务器 + 构建 |
| 样式 | **Tailwind CSS** | 原子化 CSS |
| UI 组件库 | **shadcn/ui** | 基于 Tailwind + Radix,源码进项目,美观现代 |

> **为什么选 shadcn/ui**(已确定,2026-08-25):
> - 与 Tailwind 零冲突,不引入第二套样式体系;
> - 视觉现代(Vercel 风格),适合"科研朋友圈"调性,而非企业后台风;
> - 组件源码复制进项目,AI 协作开发时可直接读源码定制,学习/改造成本低;
> - 按需打包,体积轻;社区有成熟后台/看板模板可参考。
> 备选已评估:Ant Design(风格偏企业后台,不采用)、Mantine、MUI(均不采用)。

## 开发约定

- 阶段 1 的纯 HTML/JS 前端位于后端仓库 `labnexus/web/`,可作为**参考实现**(页面交互、字段命名、接口调用方式)
- 本仓库为正式前端,采用 React + Vite + Tailwind + shadcn/ui,前后端分离
- 开发前先读后端仓库的 `AGENTS.md` 与 `docs/api-contract.md`
- 每完成一个功能,按后端契约做联调,并通过后端的手工验收清单(`docs/manual-acceptance.md`)

## 快速开始(待朋友完成初始化后补充)

```bash
npm install
npm run dev
```

> 开发环境后端默认运行在 `http://localhost:8080`,前端通过 Vite 代理转发 `/api`。

## shadcn/ui 初始化(朋友接手第一步)

```bash
npm i tailwindcss @tailwindcss/vite
npx shadcn@latest init        # 风格选默认(New York + 中性色)即可
npx shadcn@latest add button card dialog select input badge progress toast
```

建议:

- 主题色贴合后端主色调蓝色(`#3b82f6`),在 `components.json` / CSS 变量里微调;
- 字体用系统中文栈(`-apple-system, "PingFang SC", "Microsoft YaHei"`),不额外引字体文件;
- 需要看板(项目任务)时,用 `Card` 自己拼状态列,不需要额外依赖。

## 目录结构(待补充)

## License

私有项目,课题组内部使用。
