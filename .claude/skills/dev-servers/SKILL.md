---
name: dev-servers
description: このアプリの開発サーバー（PostgreSQL・バックエンド 8080・フロントエンド 5173）を起動・再起動・停止する。動作確認のためにアプリを動かすとき、サーバーを起動・再起動するとき、ポートが競合したときに使う。
---

# 開発サーバーの起動・停止

このアプリは次のポートで動かす前提になっている。**ほかのポートでは絶対に起動しない。**

| サーバー | ポート | 設定している場所 |
|---|---|---|
| バックエンド（Spring Boot） | 8080 | `backend/src/main/resources/application.yml` |
| フロントエンド（Vite） | 5173 | `frontend/vite.config.ts`（`strictPort: true`） |
| PostgreSQL（Docker Compose） | 5432 | `docker-compose.yml` |

フロントエンドは `/api` を 8080 に転送しているため、どちらかが別のポートで動くと画面から API を呼べなくなる。

## 起動

リポジトリのルートで実行する。

```sh
scripts/dev-start.sh            # DB・バックエンド・フロントエンドをすべて起動
scripts/dev-start.sh backend    # DB とバックエンドだけ
scripts/dev-start.sh frontend   # フロントエンドだけ
```

- 8080・5173 を使っているプロセスがあれば、**そのプロセスを止めてから**決められたポートで起動する。起動済みのサーバーも止めて起動し直す
- 各サーバーが応答するまで待ってから終わる。起動しなかったときはログの末尾を出して失敗する
- サーバーはバックグラウンドで動き続ける。ログは `.dev/backend.log`・`.dev/frontend.log`

## 停止

```sh
scripts/dev-stop.sh             # バックエンドとフロントエンドを止める（DB は残す）
docker compose down             # DB も止めるとき
```

## 守ること

- `--port 5174` や `--server.port=8081` のように別のポートを指定して起動しない（`.claude/hooks/guard-dev-ports.sh` がブロックする）
- `vite.config.ts` の `strictPort` を外したり、`application.yml` のポートを変えたりして逃げない
- 5432 は Colima がコンテナに転送しているポートなので、そのプロセス（ssh）は止めない
- 起動に失敗したら、ポートを変えるのではなくログを読んで原因を直す
