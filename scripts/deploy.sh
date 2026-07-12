#!/usr/bin/env bash
# AStock Quant Docker 部署脚本
# 用法：
#   ./scripts/deploy.sh init      # 生成 .env.docker
#   ./scripts/deploy.sh up        # 构建并启动
#   ./scripts/deploy.sh up-redis  # 启动并启用 Redis
#   ./scripts/deploy.sh down      # 停止
#   ./scripts/deploy.sh restart   # 重启
#   ./scripts/deploy.sh logs      # 查看日志
#   ./scripts/deploy.sh ps        # 容器状态
#   ./scripts/deploy.sh build     # 仅构建镜像

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${ENV_FILE:-.env.docker}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.yml)

die() {
  echo "错误: $*" >&2
  exit 1
}

need_docker() {
  command -v docker >/dev/null 2>&1 || die "未安装 docker"
  docker compose version >/dev/null 2>&1 || die "需要 Docker Compose V2（docker compose）"
}

ensure_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    if [[ -f .env.docker.example ]]; then
      cp .env.docker.example "$ENV_FILE"
      echo "已生成 $ENV_FILE，请先填写 Supabase 等配置后再启动。"
      echo "编辑: ${ROOT_DIR}/${ENV_FILE}"
      exit 1
    fi
    die "缺少 $ENV_FILE，请先执行: $0 init"
  fi

  if grep -q 'your-project.supabase.co\|sb_publishable_xxx\|sb_secret_xxx' "$ENV_FILE" 2>/dev/null; then
    echo "警告: $ENV_FILE 仍含占位符，生产环境请替换为真实密钥。"
  fi
}

cmd_init() {
  if [[ -f "$ENV_FILE" ]]; then
    echo "$ENV_FILE 已存在，跳过。"
    return 0
  fi
  cp .env.docker.example "$ENV_FILE"
  echo "已创建 $ENV_FILE"
  echo "请编辑该文件填写 SUPABASE_* / VITE_* 后执行: $0 up"
}

cmd_up() {
  need_docker
  ensure_env
  echo "==> 构建并启动（端口见 HTTP_PORT，默认 80）"
  "${COMPOSE[@]}" up -d --build "$@"
  echo
  echo "部署完成。"
  echo "  站点: http://localhost:$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 80)"
  echo "  健康: http://localhost:$(grep -E '^HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 80)/health"
  echo "  日志: $0 logs"
}

cmd_up_redis() {
  need_docker
  ensure_env
  # 启用 Redis 时建议同步打开 REDIS_ENABLED
  if grep -q '^REDIS_ENABLED=false' "$ENV_FILE"; then
    echo "==> 将 REDIS_ENABLED 设为 true"
    if [[ "$(uname)" == Darwin ]]; then
      sed -i '' 's/^REDIS_ENABLED=false/REDIS_ENABLED=true/' "$ENV_FILE"
    else
      sed -i 's/^REDIS_ENABLED=false/REDIS_ENABLED=true/' "$ENV_FILE"
    fi
  fi
  echo "==> 构建并启动（含 Redis）"
  "${COMPOSE[@]}" --profile redis up -d --build
  echo "完成。Redis 已启用。"
}

cmd_down() {
  need_docker
  "${COMPOSE[@]}" --profile redis down
}

cmd_restart() {
  need_docker
  ensure_env
  "${COMPOSE[@]}" restart
}

cmd_logs() {
  need_docker
  "${COMPOSE[@]}" logs -f --tail=200 "$@"
}

cmd_ps() {
  need_docker
  "${COMPOSE[@]}" ps
}

cmd_build() {
  need_docker
  ensure_env
  "${COMPOSE[@]}" build "$@"
}

usage() {
  cat <<EOF
AStock Quant 部署脚本

用法: $0 <命令>

命令:
  init       从模板生成 .env.docker
  up         构建镜像并后台启动（web + api）
  up-redis   同上，并启用 Redis profile
  down       停止并移除容器
  restart    重启服务
  logs       跟踪日志（可跟服务名: api / web）
  ps         查看容器状态
  build      仅构建镜像

环境变量:
  ENV_FILE   指定 env 文件，默认 .env.docker
EOF
}

main() {
  local cmd="${1:-}"
  shift || true
  case "$cmd" in
    init) cmd_init "$@" ;;
    up) cmd_up "$@" ;;
    up-redis) cmd_up_redis "$@" ;;
    down) cmd_down "$@" ;;
    restart) cmd_restart "$@" ;;
    logs) cmd_logs "$@" ;;
    ps) cmd_ps "$@" ;;
    build) cmd_build "$@" ;;
    -h|--help|help|"") usage ;;
    *) die "未知命令: $cmd（执行 $0 help 查看用法）" ;;
  esac
}

main "$@"
