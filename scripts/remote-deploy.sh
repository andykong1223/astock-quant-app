#!/usr/bin/env bash
# 服务器一键更新：拉最新代码并重新部署
# （deploy.sh up 已包含 git pull，此脚本为兼容入口）
# 用法：./scripts/remote-deploy.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

exec ./scripts/deploy.sh up
