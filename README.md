# AgentOS Vue Desktop

<p align="center">
  <strong>AgentScope 桌面客户端</strong><br/>
  Electron + Vue 3 + TypeScript + Ant Design Vue，对接 Agent 后端服务<br/>
  激活密钥 · 流式对话 · 沙箱访问 · 附件 / RAG / HITL
</p>

<p align="center">
  <strong>后端服务：</strong>
  <a href="https://github.com/jiangshang-dev/agentscope-agent-service">jiangshang-dev/agentscope-agent-service</a>
</p>

<p align="center">
  <a href="https://github.com/jiangshang-dev/agentscope-vue-desktop"><img src="https://img.shields.io/github/stars/jiangshang-dev/agentscope-vue-desktop?style=for-the-badge&logo=github" alt="Stars"/></a>
  <a href="https://github.com/jiangshang-dev/agentscope-vue-desktop/fork"><img src="https://img.shields.io/github/forks/jiangshang-dev/agentscope-vue-desktop?style=for-the-badge" alt="Forks"/></a>
  <img src="https://img.shields.io/badge/Electron-37-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron"/>
  <img src="https://img.shields.io/badge/Vue-3-42b883?style=for-the-badge&logo=vue.js&logoColor=white" alt="Vue 3"/>
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License"/>
</p>

---

## ⭐ 先 Star，再使用

> **开源不是义务劳动，Star 是最低成本的尊重。**
>
> 能帮到你 → 点右上角 **Star**  
> 想二开 / 商用 → **Fork** 并在项目里注明来源  
> 白嫖代码、删版权、当自己产品卖 → **不欢迎**

| 你怎么用 | 我们怎么看 |
| --- | --- |
| Star 后自用、学习、改着玩 | 欢迎 |
| 提 Issue / PR（请先 Star） | 欢迎 |
| 商用打包分发、定制开发 | 先沟通，别当空气 |
| Clone 完删作者信息、闭源倒卖 | 禁止 |

**用不了、嫌麻烦、只想白嫖？请直接关掉页面，别占用 Issues。**

👉 [点这里 Star](https://github.com/jiangshang-dev/agentscope-vue-desktop) · 花 1 秒，比「谢谢」有用。

---

## 这是什么

面向 AgentScope 的 **桌面端 Agent 工作台**，对接后端服务 [agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service)：

1. 本机 **激活密钥**（未激活不可进入对话）
2. 登录 / 注册后管理会话
3. **SSE 流式对话**（step / delta / confirm / done）
4. 选择访问范围与工作根目录，带附件、RAG、HITL 确认

```text
激活页 ──► 登录 / 注册 ──► 会话列表
                              │
                              ▼
                    SSE 流式对话（AgentOS）
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
           沙箱访问        完全访问         受限访问
```

需配合后端服务使用：

> **后端服务：** [https://github.com/jiangshang-dev/agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service)

---

## 功能亮点

- **激活密钥**：`AGOS.<payload>.<hmac>`，绑定设备指纹，写入本机 `userData/license.json`
- **登录 / 注册**：Bearer Token 鉴权
- **会话管理**：列表 / 新建 / 历史消息
- **SSE 流式对话**：step / delta / confirm / done
- **访问范围**：沙箱 / 完全访问 / 受限访问
- **工作根目录**：Electron 原生对话框选择
- **附件上传**、**RAG 开关**、**HITL 确认**
- **跨平台打包**：macOS `.dmg` · Windows Setup / portable

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 桌面壳 | Electron 37 · electron-vite · electron-builder |
| 渲染进程 | Vue 3 · TypeScript · Ant Design Vue · Pinia · Vue Router |
| 通信 | Axios · SSE（对接 [agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service)） |
| 许可 | HMAC 签发激活码（`scripts/gen-license.mjs`） |

目录结构：

```text
agentscope-vue-desktop/
├── src/main/          # Electron 主进程（含 license.ts）
├── src/preload/       # 预加载桥
├── src/renderer/      # Vue3 渲染进程
│   ├── src/api/       # 后端 API 客户端（含 SSE）
│   ├── src/stores/    # Pinia（auth / chat / license）
│   └── src/views/     # 登录 / 激活 / 聊天
├── scripts/           # gen-license.mjs
└── release/           # electron-builder 产物
```

---

## 快速开始

### 0. 请先 Star（认真的）

没 Star 也能跑，但别指望作者免费当客服。

### 1. 环境

- Node.js 18+（推荐 pnpm）
- 已启动的后端服务 [agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service)（默认 `http://127.0.0.1:8765`）

### 2. 配置接口地址

开发环境写在 **`.env.development`**（可参考 `.env.example`）：

```bash
VITE_APP_TITLE=AgentOS
VITE_API_BASE_URL=http://127.0.0.1:8765
```

生产构建使用 `.env.production`。登录页可临时覆盖；未改动时始终以 env 为准。

激活密钥 HMAC（**签发与校验必须一致**）：

```bash
export LICENSE_HMAC_SECRET='请换成足够长的随机串'
```

未设置时使用开发默认值（仅本地调试，**生产务必更换**）。

### 3. 启动后端服务（先开 API）

仓库：[agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service)

```bash
# 克隆并启动后端（以该仓库 README 为准）
git clone https://github.com/jiangshang-dev/agentscope-agent-service.git
cd agentscope-agent-service
uv run uvicorn app.main:app --host 127.0.0.1 --port 8765
```

### 4. 安装并运行桌面端

```bash
pnpm install
pnpm run reinstall:electron   # 若报 Electron uninstall，执行一次
pnpm run gen:license -- --days 365 --plan pro --uid demo
pnpm run dev
```

> pnpm 10 默认可能拦截 `electron` 安装脚本；本仓库已在 `package.json` 的 `pnpm.onlyBuiltDependencies` 放行。若仍报 `Electron uninstall`，执行 `pnpm run reinstall:electron`。
>
> 若环境里设置了 `ELECTRON_RUN_AS_NODE=1`（Cursor / 部分工具会注入），会导致 `require('electron')` 拿不到 API。`pnpm run dev` 已用 `env -u ELECTRON_RUN_AS_NODE` 自动清除。

流程：**激活页 → 登录 → 对话**。未激活访问对话会跳转激活页；发送消息也会二次拦截。

---

## 激活密钥

```bash
# 永久
pnpm run gen:license -- --forever --plan pro --uid customer-a

# 365 天
LICENSE_HMAC_SECRET='你的生产口令' pnpm run gen:license -- --days 365 --plan standard --uid customer-b
```

| 名称 | 是什么 | 干什么 |
| --- | --- | --- |
| `LICENSE_HMAC_SECRET` | 签发口令（公章） | 打包写进客户端 + 生成激活码时用 |
| `AGOS.xxx.yyy` | 激活码 | 只给用户粘贴到「软件激活」页 |

两边口令必须一致，激活码不要改坏。设备指纹在激活**之后**绑定，生成密钥时不用填指纹。

> TODO(license)：生产可改为服务端签发 + 定期在线校验，降低本地逆向风险。

---

## 打包 exe / dmg

依赖 `electron-builder`，产物在 `release/`。

```bash
# macOS → .dmg（建议在本机 Mac 上打）
LICENSE_HMAC_SECRET='生产口令' pnpm run dist:mac

# Windows → 安装包 .exe + 绿色版 portable（建议在 Windows 或 CI 上打）
LICENSE_HMAC_SECRET='生产口令' pnpm run dist:win

# 当前系统默认目标
LICENSE_HMAC_SECRET='生产口令' pnpm run dist
```

| 产物 | 说明 |
| --- | --- |
| `release/*.dmg` | macOS 安装镜像 |
| `release/*Setup*.exe` | Windows NSIS 安装程序 |
| `release/*portable*.exe` | Windows 免安装绿色版 |

未签名：macOS 可能提示「无法验证开发者」，需在系统设置中允许；Windows SmartScreen 可能拦截未签名 exe。正式发行建议购买苹果 / 微软代码签名证书。

---

## 脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm run dev` | Electron 开发模式 |
| `pnpm run build` | 打包渲染进程与主进程 |
| `pnpm run dist:mac` | 打 macOS dmg |
| `pnpm run dist:win` | 打 Windows exe |
| `pnpm run gen:license` | 签发激活密钥 |
| `pnpm run typecheck` | TS 检查 |

---

## 贡献与支持

1. **先 Star**，再提 Issue / PR  
2. PR 请说清楚：解决了什么、怎么验证  
3. 不要在 Issue 里贴真实 `LICENSE_HMAC_SECRET` 或生产激活码  
4. 「帮我免费部署 / 免费定制 Agent」请自备服务器与耐心  

觉得项目有用？

- ⭐ [Star 一下](https://github.com/jiangshang-dev/agentscope-vue-desktop)
- 🍴 Fork 二开时保留原作者与仓库链接
- 💬 分享给同样在做 Agent 桌面端的朋友

---

## 许可证与「禁止白嫖」约定

本项目以 **MIT License** 开源（见 [`LICENSE`](./LICENSE)，与 `package.json` 一致）。

在法律允许的前提下，额外约定（社交契约，不是法律条款）：

1. **个人学习 / 自用**：请 Star，注明出处更佳  
2. **二次开发**：保留原仓库链接与致谢  
3. **商用 / 对外售卖**：允许基于 MIT 使用，但禁止声称「完全自主研发」并抹掉来源；大额商用建议先联系作者  
4. **白嫖行为**（只拿代码不 Star、删版权信息、闭源倒卖包装成自家产品）：作者有权拒绝任何支持，并公开点名  

**代码可以免费，尊重不能免费。**

---

## 免责声明

- 本客户端依赖 [agentscope-agent-service](https://github.com/jiangshang-dev/agentscope-agent-service) 及你配置的模型 / 工具能力，API 不可用时桌面端无法独立完成对话  
- 激活机制为本地 HMAC 校验，存在逆向风险；生产环境请更换密钥并评估服务端校验方案  
- 因密钥泄露、未签名拦截、环境变量配置错误导致的问题，请先自查配置  

---

<p align="center">
  如果这个桌面端帮你把 Agent 跑了起来，<br/>
  <a href="https://github.com/jiangshang-dev/agentscope-vue-desktop"><strong>请给一个 Star ⭐</strong></a> —— 这是对开源最实在的反馈。
</p>
