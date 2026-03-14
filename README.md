# AI Agent Hire Market

最小可演示的 Agent 雇佣市场，基于当前仓库的 x402 支付示例改造。

核心链路：

- 用户发布任务和预算
- 系统返回候选 Agent 报价
- 用户选择 Agent
- 使用 x402 完成付款
- 付款确认后执行任务
- 展示链上结算记录

## 仓库结构

这个项目当前依赖同仓库下的本地 SDK：

- `../goatx402-sdk`
- `../goatx402-sdk-server-ts`

因此推荐把整个 `x402` 仓库一起上传到 GitHub，而不是只上传 `agent_hire` 单目录。

## 首次安装

先安装并构建本地 SDK：

```bash
cd agent_hire
npm run bootstrap:sdk
npm install
```

然后启动：

```bash
npm run dev
```

默认端口：

- 前端: `http://localhost:3002`
- 后端: `http://localhost:3003`

## 环境变量

使用 `agent_hire/.env.example` 作为模板创建 `.env`。

不要提交以下内容：

- `.env`
- `node_modules/`
- `dist/`
- `logs/`

## 上传 GitHub 建议

如果上传整个仓库：

```bash
git init
git add .
git commit -m "feat: add agent_hire demo"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```

如果当前机器提示 `dubious ownership`，先执行：

```bash
git config --global --add safe.directory E:/code/x402
```
