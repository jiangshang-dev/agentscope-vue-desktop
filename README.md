# AgentOS Vue Desktop

Electron + Vue 3 + TypeScript + Ant Design Vue 客户端，对接 agentscope-api。

## 环境变量

开发环境接口地址统一写在 **`.env.development`**：

```bash
VITE_API_BASE_URL=http://127.0.0.1:8765
```

生产构建使用 `.env.production`。登录页可临时覆盖，未改动时始终以 env 为准。

激活密钥 HMAC 密钥（签发与校验必须一致）：

```bash
export LICENSE_HMAC_SECRET='请换成足够长的随机串'
```

未设置时使用开发默认值（仅本地调试）。

## 功能

- 激活密钥（未激活不可进入对话）
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
pnpm run gen:license -- --days 365 --plan pro --uid demo   # 生成测试密钥
pnpm run dev
```

> pnpm 10 默认可能拦截 `electron` 安装脚本；本仓库已在 `package.json` 的 `pnpm.onlyBuiltDependencies` 放行。若仍报 `Electron uninstall`，执行 `pnpm run reinstall:electron`。
>
> 若环境里设置了 `ELECTRON_RUN_AS_NODE=1`（Cursor/部分工具会注入），会导致 `require('electron')` 拿不到 API。`pnpm run dev` 已用 `env -u ELECTRON_RUN_AS_NODE` 自动清除。

## 打包 exe / dmg

依赖 `electron-builder`。产物在 `release/`。

```bash
# macOS → .dmg（建议在本机 Mac 上打）
LICENSE_HMAC_SECRET='生产密钥' pnpm run dist:mac

# Windows → 安装包 .exe + 绿色版 portable（建议在 Windows 上打）
# 在 macOS 上打 Windows 包通常不稳定，推荐 CI 或 Windows 机器
LICENSE_HMAC_SECRET='生产密钥' pnpm run dist:win

# 当前系统默认目标
LICENSE_HMAC_SECRET='生产密钥' pnpm run dist
```

| 产物 | 说明 |
|------|------|
| `release/*.dmg` | macOS 安装镜像 |
| `release/*Setup*.exe` | Windows NSIS 安装程序 |
| `release/*portable*.exe` | Windows 免安装绿色版 |

未签名：macOS 可能提示「无法验证开发者」，需在系统设置中允许；Windows SmartScreen 可能拦截未签名 exe。正式发行建议购买苹果/微软代码签名证书。

## 激活密钥

```bash
# 永久
pnpm run gen:license -- --forever --plan pro --uid customer-a

# 365 天
LICENSE_HMAC_SECRET='生产密钥' pnpm run gen:license -- --days 365 --plan standard --uid customer-b
```

密钥格式：`AGOS.<payload>.<hmac>`。客户端激活后写入本机 `userData/license.json`，并绑定设备指纹。

流程：激活页 → 登录 → 对话。未激活访问对话会跳转激活页；发送消息也会二次拦截。

TODO(license)：生产可改为服务端签发 + 定期在线校验，降低本地逆向风险。

## 脚本

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | Electron 开发模式 |
| `pnpm run build` | 打包渲染进程与主进程 |
| `pnpm run dist:mac` | 打 macOS dmg |
| `pnpm run dist:win` | 打 Windows exe |
| `pnpm run gen:license` | 签发激活密钥 |
| `pnpm run typecheck` | TS 检查 |

## 目录

```
src/main/          Electron 主进程（含 license.ts）
src/preload/       预加载桥
src/renderer/      Vue3 渲染进程
  src/api/         agentscope-api 客户端（含 SSE）
  src/stores/      Pinia（auth / chat / license）
  src/views/       登录 / 激活 / 聊天
scripts/           gen-license.mjs
release/           electron-builder 产物
```
