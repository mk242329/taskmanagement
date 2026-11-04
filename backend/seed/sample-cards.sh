#!/bin/bash
# 開発用のサンプルカードを、API を通して入れる（バックエンドを起動してから実行する）
# 何度実行しても同じ状態になるよう、既存のカードを消してから入れ直す
# 期限は実行した時刻からの相対値にして、期限切れ・今日・近日・期限なしがそろうようにしている
#
# 実行方法（リポジトリのルートで）：
#   backend/seed/sample-cards.sh
set -euo pipefail

API=${API:-http://localhost:8080/api/cards}

# 今から指定した時間ずらした日時（例：+3d・-2H）を UTC の ISO 8601 で返す
at() {
  date -u -v"$1" +%Y-%m-%dT%H:%M:%SZ
}

add() {
  local title=$1 description=$2 due_at=$3 strict=$4 list_id=$5
  jq -n --arg title "$title" --arg description "$description" --arg dueAt "$due_at" \
    --argjson strict "$strict" --arg listId "$list_id" \
    '{title: $title, description: $description, dueAt: (if $dueAt == "" then null else $dueAt end), strict: $strict, listId: $listId}' |
    curl -sf -X POST "$API" -H 'Content-Type: application/json' -d @- >/dev/null
}

for id in $(curl -sf "$API" | jq -r '.[].id'); do
  curl -sf -X DELETE "$API/$id"
done

add '要件定義書を見直す'        '機能要件の抜け漏れを確認する'            "$(at +3d)" false todo
add 'API 設計をまとめる'        'エンドポイントと JSON の形を決める'      "$(at +2H)" true  todo
add 'Java の復習'               ''                                        ''          false todo
add 'カード一覧 API を実装する' 'GET /api/cards'                          "$(at +1d)" false doing
add '週報を提出する'            '先週分の週報'                            "$(at -1d)" true  doing
add '開発環境を作る'            'Docker Compose で DynamoDB Local を起動' "$(at -2d)" false done

echo "サンプルのカードを入れました（$(curl -sf "$API" | jq length) 枚）"
