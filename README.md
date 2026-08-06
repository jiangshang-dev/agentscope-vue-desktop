# AgentOS Vue Desktop

Electron + Vue 3 + TypeScript + Ant Design Vue 客户端，对接 agentscope-api。

## 环境变量

开发环境接口地址统一写在 **`.env.development`**：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8765
```

生产构建使用 `.env.production`。登录页可临时覆盖，未改动时始终以 env 为准。

## 功能

- 登录 / 注册（Bearer Token）
- 会话列表 / 新建 / 历史消息
- SSE 流式对话（step / delta / confirm / done）
- 访问范围：沙箱 / 完全访问 / 受限访问
- 工作根目录选择（Electron 原生对话框）
- 附件上传、RAG 开关、HITL 确认

## 启动

```bash
# 1) 先启动 API
cd /Users/xiaobai/Deveploer/workspace/itheima/agentscope-api
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765

# 2) 安装并运行桌面端（推荐 pnpm）
cd /Users/xiaobai/DevEcoStudioProjects/agentscope-vue-desktop
pnpm install
pnpm run reinstall:electron   # 若报 Electron uninstall，执行一次
pnpm run dev
```

> pnpm 10 默认可能拦截 `electron` 安装脚本；本仓库已在 `package.json` 的 `pnpm.onlyBuiltDependencies` 放行。若仍报 `Electron uninstall`，执行 `pnpm run reinstall:electron`。
>
> 若环境里设置了 `ELECTRON_RUN_AS_NODE=1`（Cursor/部分工具会注入），会导致 `require('electron')` 拿不到 API。`pnpm run dev` 已用 `env -u ELECTRON_RUN_AS_NODE` 自动清除。

## 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | Electron 开发模式 |
| `npm run build` | 打包渲染进程与主进程 |
| `npm run typecheck` | TS 检查 |

## 目录

```
src/main/          Electron 主进程
src/preload/       预加载桥
src/renderer/      Vue3 渲染进程
  src/api/         agentscope-api 客户端（含 SSE）
  src/stores/      Pinia（auth / chat）
  src/views/       登录页 / 聊天页
```
