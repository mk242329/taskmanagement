#!/bin/bash
# dev-start.sh で起動したバックエンドとフロントエンドを止める。
# DB（PostgreSQL のコンテナ）は止めない。止めるときは docker compose down。
set -euo pipefail
source "$(dirname "$0")/dev-common.sh"

free_port "$BACKEND_PORT"
free_port "$FRONTEND_PORT"
echo "バックエンド（$BACKEND_PORT）とフロントエンド（$FRONTEND_PORT）を停止しました"
