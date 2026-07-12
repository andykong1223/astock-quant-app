#!/usr/bin/env bash
# 配置 Docker Hub 国内镜像加速（需 root）
# 用法：sudo ./scripts/setup-docker-mirror.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${ROOT_DIR}/deploy/docker-daemon-mirror.json"
DEST="/etc/docker/daemon.json"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "请使用 root 执行: sudo $0" >&2
  exit 1
fi

mkdir -p /etc/docker

if [[ -f "$DEST" ]]; then
  backup="${DEST}.bak.$(date +%Y%m%d%H%M%S)"
  cp "$DEST" "$backup"
  echo "已备份原配置到 $backup"
  # 若已有 JSON，尝试用 python 合并 registry-mirrors；失败则直接覆盖提示
  if command -v python3 >/dev/null 2>&1; then
    python3 - "$DEST" "$SRC" <<'PY'
import json, sys
dest, src = sys.argv[1], sys.argv[2]
with open(dest) as f:
    cur = json.load(f)
with open(src) as f:
    add = json.load(f)
mirrors = list(dict.fromkeys((cur.get("registry-mirrors") or []) + (add.get("registry-mirrors") or [])))
cur["registry-mirrors"] = mirrors
with open(dest, "w") as f:
    json.dump(cur, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("已合并 registry-mirrors 到", dest)
PY
  else
    cp "$SRC" "$DEST"
    echo "已写入 $DEST（未检测到 python3，直接覆盖）"
  fi
else
  cp "$SRC" "$DEST"
  echo "已写入 $DEST"
fi

systemctl daemon-reload 2>/dev/null || true
systemctl restart docker
echo "Docker 已重启，当前镜像加速："
docker info 2>/dev/null | grep -A5 'Registry Mirrors' || cat "$DEST"
