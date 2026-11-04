#!/bin/bash
# フロントエンドを AWS にデプロイする。
# ビルドした画面を SSH で EC2 に送り、nginx が配信する場所（/opt/taskapp/frontend）に置き換える。
#   使い方: scripts/deploy-frontend.sh
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
source "$ROOT/scripts/deploy-common.sh"

echo "== 画面をビルドします"
npm --prefix "$ROOT/frontend" ci
npm --prefix "$ROOT/frontend" run build

echo "== EC2（$HOST）に画面のファイルを送ります"
tar -C "$ROOT/frontend/dist" -czf - . | ssh "${SSH_OPTS[@]}" "ec2-user@$HOST" '
  set -e
  sudo find /opt/taskapp/frontend -mindepth 1 -delete
  sudo tar -xzf - -C /opt/taskapp/frontend --no-same-owner
'

echo "== 完了: $(tf_output app_url)"
