#!/bin/bash
# バックエンドを AWS にデプロイする。
# jar をビルドし、起動スクリプト（backend/lambda/run.sh）と一緒に zip にして、Lambda のコードを入れ替える。
#   使い方: scripts/deploy-backend.sh
set -euo pipefail

export AWS_PROFILE=${AWS_PROFILE:-taskapp}
ROOT=$(git rev-parse --show-toplevel)

tf_output() {
  terraform -chdir="$ROOT/infra" output -raw "$1"
}

REGION=$(tf_output region)
FUNCTION=$(tf_output backend_function_name)

echo "== jar をビルドします（テストは CI で動かしているので、ここでは飛ばす）"
(cd "$ROOT/backend" && ./mvnw -B -q package -DskipTests)

echo "== Lambda に入れる zip を作ります"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
cp "$ROOT"/backend/target/taskapp-*.jar "$WORK/taskapp.jar"
cp "$ROOT/backend/lambda/run.sh" "$WORK/run.sh"
chmod 755 "$WORK/run.sh"
(cd "$WORK" && zip -q -X lambda.zip taskapp.jar run.sh)

echo "== Lambda のコードを入れ替えます"
aws lambda update-function-code --region "$REGION" --function-name "$FUNCTION" \
  --zip-file "fileb://$WORK/lambda.zip" --query LastUpdateStatus --output text
aws lambda wait function-updated-v2 --region "$REGION" --function-name "$FUNCTION"

echo "== 完了: $(tf_output app_url)"
echo "   最初のアクセスは Spring Boot の起動を待つため、数秒かかります"
