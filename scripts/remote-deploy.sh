#!/usr/bin/env bash
# 一键同步代码并重新部署（适合服务器上已有仓库目录）
# 用法：./scripts/remote-deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> 拉取最新代码"
git pull --ff-only

echo "==> 重新构建并启动"
exec ./scripts/deploy.sh up
