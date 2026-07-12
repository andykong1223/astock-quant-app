# AStock Quant · A股量化分析平台

移动优先的 A 股量化分析网站：自选股、K 线/技术指标、财务看板、条件选股、双均线策略回测。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Vue 3 + TypeScript + Vite + Naive UI + Pinia + ECharts |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | Supabase (PostgreSQL) · 默认 Demo 内存数据可离线跑通 |
| 缓存 | Redis（可选）/ 内存 TTL 缓存 |

## 快速开始

### 1. 安装依赖

```bash
cd astock-quant-app
npm install
```

### 2. 启动（演示模式，无需 Supabase）

```bash
npm run dev
```

- 前端：http://localhost:5173  
- 后端：http://localhost:3000  

演示账号：`demo@astock.com` / `demo123456`

### 3. 连接 Supabase（可选）

1. 在 Supabase SQL Editor 执行 `supabase/schema.sql` 与 `supabase/seed.sql`
2. 复制 `.env.example` 为根目录 / `backend/.env` / `frontend/.env`，填入真实密钥
3. 设置 `DEMO_MODE=false` 与 `VITE_DEMO_MODE=false`

## 项目结构

```
astock-quant-app/
├── frontend/          # Vue 3 应用
├── backend/           # Express API
├── supabase/          # Schema & Seed
├── package.json       # monorepo workspaces
└── .env.example
```

## 主要功能

- **认证**：邮箱注册/登录/登出/密码重置（Demo 或 Supabase Auth）
- **自选股**：搜索、添加/删除、分组管理、涨跌幅排序、自动刷新（3/5/10s）
- **行情**：总览列表、个股详情、日/周/月 K、MA/MACD/RSI/BOLL、分时图
- **量化**：财务指标、资金流向（演示）、条件选股、双均线回测、CSV 导出
- **策略**：保存/管理用户策略配置

## API 概览

Base URL: `/api/v1`

| 模块 | 示例 |
|------|------|
| Auth | `POST /auth/login` |
| Stocks | `GET /stocks/search?q=茅台` |
| Watchlist | `GET /watchlist`（需登录） |
| Quant | `POST /quant/backtest` |
| Strategies | `GET /strategies` |

统一响应：`{ code: 0, message: "success", data: ... }`

## 脚本

```bash
npm run dev          # 同时启动前后端
npm run dev:web      # 仅前端
npm run dev:server   # 仅后端
npm run build        # 构建
```

## 适配说明

- 手机 `<768px`：底部 Tab 导航
- 平板 / PC：侧边栏布局
- 安全区：`env(safe-area-inset-bottom)`
- 可点击区域 ≥ 44px

## 许可证

MIT
