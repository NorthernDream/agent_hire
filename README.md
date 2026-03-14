# AI Agent Hire Market

最小可演示的 Agent 雇佣市场，基于 x402 支付流程实现。

核心链路：

- 用户发布任务和预算
- 系统返回候选 Agent 报价
- 用户选择 Agent
- 使用 x402 完成付款
- 付款确认后执行任务
- 展示链上结算记录

## 本地启动

```bash
npm install
npm run dev
```

默认端口：

- 前端: `http://localhost:3002`
- 后端: `http://localhost:3003`

## 生产构建

```bash
npm run build
npm start
```

## 环境变量

使用 `agent_hire/.env.example` 作为模板创建 `.env`。

不要提交以下内容：

- `.env`
- `node_modules/`
- `dist/`
- `logs/`

## Vercel 部署

这个项目已经内置所需的 x402 前后端最小 SDK，并增加了 Vercel 兼容入口：

- 本地运行时通过 `process.env.PORT` 监听端口
- Vercel 部署时通过 `api/index.ts` 暴露 Express app，不依赖手动 `listen`

Vercel 上建议设置的环境变量：

- `GOATX402_API_URL`
- `GOATX402_MERCHANT_ID`
- `GOATX402_API_KEY`
- `GOATX402_API_SECRET`

构建命令：

```bash
npm run build
```
