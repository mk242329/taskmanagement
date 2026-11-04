#!/bin/bash
# バックエンドを AWS にデプロイする。
# jar をビルドして SSH で EC2 に送り、Spring Boot（systemd の taskapp）を起動し直す。
#   使い方: scripts/deploy-backend.sh
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
source "$ROOT/scripts/deploy-common.sh"

echo "== jar をビルドします（テストは CI で動かしているので、ここでは飛ばす）"
(cd "$ROOT/backend" && ./mvnw -B -q package -DskipTests)

echo "== EC2（$HOST）に jar を送ります"
scp "${SSH_OPTS[@]}" "$ROOT"/backend/target/taskapp-*.jar "ec2-user@$HOST:/tmp/taskapp.jar"

echo "== Spring Boot を起動し直します"
ssh "${SSH_OPTS[@]}" "ec2-user@$HOST" '
  set -e
  sudo install -m 644 /tmp/taskapp.jar /opt/taskapp/taskapp.jar
  rm /tmp/taskapp.jar
  sudo systemctl restart taskapp
  # API が応答するまで待つ（最大 90 秒）
  for _ in $(seq 90); do
    curl -sf -o /dev/null http://localhost:8080/api/cards && exit 0
    sleep 1
  done
  echo "Spring Boot が起動しませんでした。ログ：sudo journalctl -u taskapp -n 50" >&2
  exit 1
'

echo "== 完了: $(tf_output app_url)"
