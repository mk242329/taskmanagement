#!/bin/bash
# 開発用の DB・バックエンド・フロントエンドを、決められたポートで起動する。
# ポートがほかのプロセスに使われていたら、そのプロセスを止めてから起動する（別のポートにはずらさない）。
#
#   scripts/dev-start.sh            … すべて起動（起動済みのバックエンド・フロントエンドは再起動）
#   scripts/dev-start.sh backend    … バックエンドだけ
#   scripts/dev-start.sh frontend   … フロントエンドだけ
#
# ログは .dev/backend.log・.dev/frontend.log に出る。止めるときは scripts/dev-stop.sh。
set -euo pipefail
source "$(dirname "$0")/dev-common.sh"

target=${1:-all}
mkdir -p "$LOG_DIR"

start_db() {
  if ! colima status >/dev/null 2>&1; then
    echo "Colima を起動します"
    colima start
  fi
  # 5432 は Colima がコンテナへ転送しているため、止めずに docker compose に任せる
  (cd "$ROOT" && docker compose up -d db)
  for _ in $(seq 1 30); do
    if (cd "$ROOT" && docker compose exec -T db pg_isready -U taskapp -d taskapp >/dev/null 2>&1); then
      echo "PostgreSQL が起動しました: localhost:$DB_PORT"
      return 0
    fi
    sleep 1
  done
  echo "エラー: PostgreSQL が起動しませんでした。" >&2
  exit 1
}

start_backend() {
  free_port "$BACKEND_PORT"
  echo "バックエンドを起動します（ポート $BACKEND_PORT）"
  # 出力をまるごとログに向ける（呼び出し元の出力を開いたままにすると、このスクリプトが終わらなくなる）
  (cd "$ROOT/backend" && exec nohup ./mvnw spring-boot:run) >"$LOG_DIR/backend.log" 2>&1 </dev/null &
  wait_for "バックエンド" "http://localhost:$BACKEND_PORT/api/cards" 180 "$LOG_DIR/backend.log"
}

start_frontend() {
  free_port "$FRONTEND_PORT"
  if [ ! -d "$ROOT/frontend/node_modules" ]; then
    (cd "$ROOT/frontend" && npm install)
  fi
  echo "フロントエンドを起動します（ポート $FRONTEND_PORT）"
  (cd "$ROOT/frontend" && exec nohup npm run dev -- --port "$FRONTEND_PORT" --strictPort) >"$LOG_DIR/frontend.log" 2>&1 </dev/null &
  wait_for "フロントエンド" "http://localhost:$FRONTEND_PORT/" 60 "$LOG_DIR/frontend.log"
}

case "$target" in
  all)
    start_db
    start_backend
    start_frontend
    ;;
  backend)
    start_db
    start_backend
    ;;
  frontend)
    start_frontend
    ;;
  *)
    echo "使い方: $0 [all|backend|frontend]" >&2
    exit 1
    ;;
esac
