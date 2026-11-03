#!/bin/bash
# フロントエンドを AWS にデプロイする。
# ビルドした画面を S3 に置き、CloudFront の古いキャッシュを消す。
#   使い方: scripts/deploy-frontend.sh
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-taskapp}
ROOT=$(git rev-parse --show-toplevel)

tf_output() {
  terraform -chdir="$ROOT/infra" output -raw "$1"
}

BUCKET=$(tf_output frontend_bucket)
DISTRIBUTION_ID=$(tf_output cloudfront_distribution_id)

echo "== 画面をビルドします"
npm --prefix "$ROOT/frontend" ci
npm --prefix "$ROOT/frontend" run build

echo "== S3 にアップロードします"
aws s3 sync "$ROOT/frontend/dist" "s3://$BUCKET" --delete

echo "== CloudFront のキャッシュを消します"
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" \
  --query Invalidation.Id --output text

echo "== 完了: $(tf_output app_url)"
