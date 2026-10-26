#!/bin/bash
# バックエンドを AWS にデプロイする。
# イメージをビルドして ECR に push し、EC2 の上でコンテナを起動し直す。
#   使い方: scripts/deploy-backend.sh
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-taskapp}
ROOT=$(git rev-parse --show-toplevel)

tf_output() {
  terraform -chdir="$ROOT/infra" output -raw "$1"
}

REGION=$(tf_output region)
REPO=$(tf_output ecr_repository_url)
INSTANCE_ID=$(tf_output backend_instance_id)

echo "== イメージをビルドして ECR に push します"
aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "${REPO%%/*}"
# EC2 は Graviton（arm64）なので arm64 でビルドする
docker build --platform linux/arm64 -t "$REPO:latest" "$ROOT/backend"
docker push "$REPO:latest"

echo "== EC2 でコンテナを起動し直します"
COMMAND_ID=$(aws ssm send-command --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["/opt/taskapp/restart.sh"]' \
  --query Command.CommandId --output text)

aws ssm wait command-executed --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" || true
aws ssm get-command-invocation --region "$REGION" --command-id "$COMMAND_ID" --instance-id "$INSTANCE_ID" \
  --query '{status: Status, output: StandardOutputContent, error: StandardErrorContent}' --output yaml

echo "== 完了: $(tf_output app_url)"
