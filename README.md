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
├── deploy/nginx/      # 生产 Nginx 配置
├── scripts/           # 部署脚本
├── docker-compose.yml
├── .env.example
└── .env.docker.example
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

## 行情数据源

默认接入公开行情（无需 Key）：

| 用途 | 来源 |
|------|------|
| A 股列表 / 实时 | 东方财富 `push2delay` |
| 日 K 线 | 腾讯财经 `fqkline` |

```bash
# 全量同步股票列表 + 实时（约 1–2 分钟）
npm run sync:market --workspace=backend

# 或 HTTP
curl -X POST http://localhost:3000/api/v1/sync/universe
curl http://localhost:3000/api/v1/sync/status
```

个股日线会在首次打开详情且本地过期时自动补齐。

## Docker 部署

```bash
# 1. （推荐）配置 Docker Hub 国内加速
./scripts/deploy.sh mirror

# 2. 生成环境配置并填写 Supabase 密钥
./scripts/deploy.sh init
# 编辑 .env.docker（含 DOCKER_REGISTRY=docker.m.daocloud.io）

# 3. 构建并启动（默认 http://localhost ；会先 git pull）
./scripts/deploy.sh up

# 仅拉取代码
./scripts/deploy.sh pull

# 本地已改代码、不想 pull 时：
# SKIP_GIT_PULL=1 ./scripts/deploy.sh up

# 可选：启用 Redis
./scripts/deploy.sh up-redis

# 常用
./scripts/deploy.sh logs
./scripts/deploy.sh ps
./scripts/deploy.sh down
```

构建默认走国内源：

| 类型 | 源 |
|------|-----|
| 基础镜像 | `docker.m.daocloud.io/library/...`（可用 `DOCKER_REGISTRY` 改） |
| npm | `https://registry.npmmirror.com` |
| apt | 阿里云 Debian 镜像 |

| 文件 | 说明 |
|------|------|
| `docker-compose.yml` | web(nginx) + api(+可选 redis) |
| `backend/Dockerfile` | API 多阶段构建 |
| `frontend/Dockerfile` | 前端构建 + Nginx |
| `deploy/nginx/default.conf` | `/api` 反代到后端 |
| `deploy/docker-daemon-mirror.json` | Docker Hub 加速配置 |
| `.env.docker.example` | 生产环境变量模板 |
| `scripts/deploy.sh` | 本地/服务器部署 |
| `scripts/setup-docker-mirror.sh` | 写入 daemon 镜像加速 |
| `scripts/remote-deploy.sh` | `git pull` 后重新部署 |

服务器更新：

```bash
./scripts/remote-deploy.sh
```

## 适配说明

- 手机 `<768px`：底部 Tab 导航
- 平板 / PC：侧边栏布局
- 安全区：`env(safe-area-inset-bottom)`
- 可点击区域 ≥ 44px

## 许可证

MIT
