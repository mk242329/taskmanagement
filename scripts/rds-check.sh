#!/bin/bash
# RDS（PostgreSQL）に EC2 からだけ接続できることを確かめる。
#   1. 自分の PC から RDS の 5432 につながらないこと
#   2. EC2 から psql で接続し、テーブルを作って読み書きできること（確認用のテーブルは最後に消す）
#   使い方: scripts/rds-check.sh（先に -var=enable_rds=true で apply し、EC2 を起動しておく）
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
source "$ROOT/scripts/deploy-common.sh"

DB_HOST=$(tf_output rds_endpoint)
SECRET_ARN=$(tf_output rds_secret_arn)

echo "== RDS の接続先: $DB_HOST"
echo "== 1. 自分の PC から 5432 につながらないことを確かめます"
if nc -z -w 5 "$DB_HOST" 5432 2>/dev/null; then
  echo "NG: 自分の PC から RDS につながりました。セキュリティグループと publicly_accessible を確かめてください" >&2
  exit 1
fi
echo "OK: つながりませんでした"

echo "== 2. EC2（$HOST）から接続して読み書きします"
# パスワードは Secrets Manager から読み、画面にもコマンドの引数にも出さずに SSH の標準入力で渡す
aws secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text |
  python3 -c 'import json, sys; print(json.load(sys.stdin)["password"])' |
  ssh "${SSH_OPTS[@]}" "ec2-user@$HOST" "
    set -e
    read -r PGPASSWORD
    export PGPASSWORD PGHOST='$DB_HOST' PGUSER=taskapp PGDATABASE=taskapp PGSSLMODE=require
    command -v psql >/dev/null || sudo dnf install -y -q postgresql17
    psql -v ON_ERROR_STOP=1 -X <<'SQL'
\\echo '-- 接続先'
SELECT current_user, current_database(), inet_server_addr() AS server_ip, version();
\\echo '-- 暗号化（SSL）'
SELECT ssl, version AS tls FROM pg_stat_ssl WHERE pid = pg_backend_pid();
\\echo '-- 書き込みと読み込み'
CREATE TABLE rds_check (id serial PRIMARY KEY, message text NOT NULL, created_at timestamptz DEFAULT now());
INSERT INTO rds_check (message) VALUES ('EC2 から書き込みました');
SELECT * FROM rds_check;
DROP TABLE rds_check;
SQL
  "
echo "== 完了: EC2 からだけ接続できることを確かめました"
