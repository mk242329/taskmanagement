#!/bin/bash
# 開発サーバーを決められたポート以外で起動するコマンドをブロックする PreToolUse フック。
# バックエンドは 8080、フロントエンドは 5173 で動かす（CLAUDE.md の「開発サーバーの起動」）。
# 終了コード 2 で終わると Claude Code はコマンドを実行せず、stderr の内容を Claude に返す。

command=$(jq -r '.tool_input.command // ""')

BACKEND_PORT=8080
FRONTEND_PORT=5173

block() {
  echo "ブロック: $1" >&2
  echo "ポートが使われているときは、別のポートで起動せず scripts/dev-start.sh を使ってください（使っているプロセスを止めてから決められたポートで起動します）。" >&2
  exit 2
}

# 指定されたパターンにある数字（ポート番号）のうち、決められたポートと違うものを返す
other_ports() {
  grep -Eo "$1" <<<"$command" | grep -Eo '[0-9]+$' | grep -vx "$2" | head -n 1
}

# フロントエンド（Vite）
if grep -Eq '(^|[^[:alnum:]_-])(vite|npm[[:space:]]+run[[:space:]]+dev|npm[[:space:]]+(run[[:space:]]+)?start)([[:space:]]|$|;|&|\|)' <<<"$command"; then
  port=$(other_ports '(--port|-p)[=[:space:]]+[0-9]+' "$FRONTEND_PORT")
  if [ -n "$port" ]; then
    block "フロントエンドは $FRONTEND_PORT 番ポートで起動してください（指定: $port）。"
  fi
  if grep -Eq -- '--strictPort[=[:space:]]+false|--no-strictPort' <<<"$command"; then
    block "フロントエンドの strictPort を無効にして起動しないでください。"
  fi
fi

# バックエンド（Spring Boot）
if grep -Eq 'spring-boot:run|mvnw|java[[:space:]].*-jar|SERVER_PORT' <<<"$command"; then
  port=$(other_ports '(server\.port|SERVER_PORT)[=[:space:]]+[0-9]+' "$BACKEND_PORT")
  if [ -n "$port" ]; then
    block "バックエンドは $BACKEND_PORT 番ポートで起動してください（指定: $port）。"
  fi
fi

exit 0
