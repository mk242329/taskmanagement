#!/bin/bash
# Lambda で Spring Boot を起動する。Lambda Web Adapter（レイヤー）がこのスクリプトを実行し、
# 受け取ったリクエストを 8080 番ポートの Spring Boot に HTTP で渡す。scripts/deploy-backend.sh が jar と一緒に zip にする
#   -XX:TieredStopAtLevel=1 … 最適化をほどほどにして、起動（コールドスタート）を速くする
exec java -XX:+TieredCompilation -XX:TieredStopAtLevel=1 -jar "$LAMBDA_TASK_ROOT/taskapp.jar"
