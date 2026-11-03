#!/bin/bash
# Terraform を使い始めるときに 1 回だけ実行する。
# state を置く S3 バケットがなければ作り、terraform init でそこにつなぐ。
#   使い方: scripts/infra-init.sh
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-taskapp}
REGION=ap-northeast-1
ROOT=$(git rev-parse --show-toplevel)

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET="taskapp-tfstate-$ACCOUNT_ID"

if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "state 用のバケットはすでにあります: $BUCKET"
else
  echo "state 用のバケットを作ります: $BUCKET"
  aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  # 過去の版を残し、state が壊れても戻せるようにする
  aws s3api put-bucket-versioning --bucket "$BUCKET" \
    --versioning-configuration Status=Enabled
fi

terraform -chdir="$ROOT/infra" init -backend-config="bucket=$BUCKET"
