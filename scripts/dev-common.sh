#!/bin/bash
# dev-start.sh・dev-stop.sh から読み込む共通の設定と関数。

# 決められたポート。変えるときは application.yml・vite.config.ts・CLAUDE.md もそろえる
BACKEND_PORT=8080    # backend/src/main/resources/application.yml の server.port
FRONTEND_PORT=5173   # frontend/vite.config.ts の server.port
DB_PORT=5432         # docker-compose.yml の db の ports

# スクリプトを実行したリポジトリ（作業ツリー）を対象にする
ROOT=$(git rev-parse --show-toplevel)
LOG_DIR="$ROOT/.dev"

listening_pids() {
  lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

# ポートを使っているプロセスを止める。止まらなければ強制終了する
free_port() {
  local port=$1 pids
  pids=$(listening_pids "$port")
  [ -z "$pids" ] && return 0

  echo "ポート $port を使っているプロセスを停止します:"
  ps -o pid=,command= -p "$(paste -sd, - <<<"$pids")" | cut -c1-150 | sed 's/^/  /'
  kill $pids 2>/dev/null || true

  for _ in $(seq 1 20); do
    [ -z "$(listening_pids "$port")" ] && return 0
    sleep 0.5
  done

  pids=$(listening_pids "$port")
  echo "停止しないため強制終了します: $pids"
  kill -9 $pids 2>/dev/null || true
  sleep 1
  if [ -n "$(listening_pids "$port")" ]; then
    echo "エラー: ポート $port を空けられませんでした。" >&2
    exit 1
  fi
}

# URL が応答するまで待つ。待ちきれなければログの末尾を出して終わる
wait_for() {
  local name=$1 url=$2 timeout=$3 log=$4
  for _ in $(seq 1 "$timeout"); do
    if curl -s -o /dev/null "$url"; then
      echo "$name が起動しました: $url"
      return 0
    fi
    sleep 1
  done
  echo "エラー: $name が ${timeout} 秒以内に起動しませんでした。ログ（$log）の末尾:" >&2
  tail -n 30 "$log" >&2
  exit 1
}
