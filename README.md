# dsh-ibka-balance — DeepSeek API 余额监测（常驻卡片）

一个为 [DeepSeek Harness](https://github.com/deepseek-ai) (dsh) Web 界面编写的**常驻余额监测插件**：
在聊天输入框下方的统计栏里实时显示 DeepSeek API 账户余额，每 5 分钟自动刷新，余额过低时变色提醒。

> 本插件最初由一轮 AI 辅助开发会话产出，随后打包为常驻插件并发布到社区。Architecture: Host 端通过 `credentials` 服务取 API Key，经 `subprocess` + `curl` 请求 `https://api.deepseek.com/user/balance`，注册 HTTP 路由 `/api/ibka-balance`；Client 端用浏览器原生 `window.fetch` 轮询并渲染在 `conversation.composer.dock` 插槽。

## 功能

- 🟢 实时显示总余额（`total_balance`，多币种求和）
- 🔄 每 5 分钟自动刷新 + 手动 ⟳ 刷新按钮
- 🟠 < ¥10 变橙色 · 🔴 < ¥5 变红色 · 账户不可用变红
- ℹ️ 悬停显示充值余额 / 赠金余额明细
- 🔒 API Key 只在 Host 端，绝不出进程、不进浏览器

## 安装（手动）

1. 将本仓库的 `dsh-ibka-balance` 目录复制到你的 profile 的 node_modules 下：
   `~/.dsh/profiles/web/node_modules/dsh-ibka-balance/`
2. 在 `~/.dsh/profiles/web/cordis.patch.yml` 末尾追加：

   ```yaml
   - insert:
       - id: ibka-balance
         name: 'dsh-ibka-balance'
   ```

3. 重启 DeepSeek Harness App（web 模式暂不热更新配置），必要时刷新浏览器页面。

依赖：`curl`（macOS 自带）、`DEEPSEEK_API_KEY` 凭据（已存在于 `~/.dsh/.credentials.yaml` 或环境变量）。

## 卸载

删除 `cordis.patch.yml` 中对应的 `insert` 行，并删除 `node_modules/dsh-ibka-balance` 目录，重启即可。

## 原理

| 层 | 职责 |
|---|---|
| Host | `inject: ['webServer', 'credentials']` 等待服务就绪；`webServer.register` 两个精确路由：`GET /api/ibka-balance`（余额）、`POST /api/ibka-balance/log`（客户端自诊断上报，写入工作区 `balance-card-report.txt`） |
| Client | `window.__ModuleLoader__.load` 打包的浏览器模块；注册 `conversation.composer.dock` 插槽条目（防重复注册），`window.fetch` 轮询，`window.setInterval` 定时 |

## 许可证

MIT © phonejoy
