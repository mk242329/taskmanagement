# taskmanagement
Task Management Project

Trello風のタスク管理アプリです。スクールの課題として作成しています。

## 要件

詳細は [要件定義書](docs/requirements.md)、設計書（[docs/design/](docs/design/)）、[テスト仕様書](docs/test-spec.md) を参照してください。

### 前提
- 利用者：自分ひとり（ログイン・共有機能は不要）
- 用途：仕事のタスクや勉強の進み具合の管理

### リスト
- 「未着手」「作業中」「完了」の3つ

### カードの項目
| 項目 | 内容 |
|---|---|
| タイトル | 必須 |
| 説明文 | 任意 |
| 優先度 | 高・中・低 の3段階。期限と時間厳守から自動で決まる |
| 時間厳守 | 遅れてはいけないタスクに付ける。優先度が1段階上がる |
| 期限 | 日付と時刻 |

### 機能
1. カードを追加する
2. カードを削除する
3. カードをリスト間で移動する・リスト内で並び替える（カードのチェックボックスにチェックを付けると、次のリストへ自動で移る）
4. カードを編集する（タイトル・説明文・期限・時間厳守）
5. ブラウザを閉じても内容が残る（PostgreSQL に保存）
6. リマインド機能：期限の時刻にブラウザ通知を表示する
   - アプリのタブを開いている間のみ通知される（別のタブや別のアプリを使用中でも届く）
7. 期限を過ぎた未完了のカードを赤色で目立たせる
8. 優先度を、期限の近さと時間厳守かどうかから自動で決める

### 使う技術
| 区分 | 技術 |
|---|---|
| バックエンド | Java 21、Spring Boot、Spring Data JPA、Flyway、Maven |
| フロントエンド | React、TypeScript、Vite、dnd-kit |
| データベース | PostgreSQL（Docker Compose で起動） |

Next.js は使いません。詳細は [技術スタック](docs/design/tech-stack.md) を参照してください。

### 対象外（今回は作らない）
- 優先度・期限での自動並べ替え
- ログイン・他の人との共有
- 担当者の割り当て
- 複数ボード
- ブラウザを閉じている間の通知

## 開発環境の起動

Docker は Colima（Docker Desktop を使わずにコマンドだけで動かせる Docker）を使います。

### 初回だけ

```sh
brew install colima docker docker-compose
```

`~/.docker/config.json` に次を追加し、`docker compose` を使えるようにします。

```json
"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]
```

### 毎回

次の 1 コマンドで、DB・バックエンド（http://localhost:8080）・フロントエンド（http://localhost:5173）をまとめて起動できます。ポートがほかのプロセスに使われているときは、そのプロセスを止めてから決められたポートで起動します。

```sh
scripts/dev-start.sh      # すべて起動（backend / frontend を付けるとそれだけ）
scripts/dev-stop.sh       # バックエンドとフロントエンドを止める
```

ログは `.dev/backend.log`・`.dev/frontend.log` に出ます。手動で起動するときは次のとおりです。

```sh
colima start              # Docker を起動（Mac を再起動したら毎回必要）
docker compose up -d      # PostgreSQL を起動
cd backend && ./mvnw spring-boot:run   # バックエンドを起動（http://localhost:8080）
```

別のターミナルでフロントエンドを起動し、http://localhost:5173 を開きます。`/api` へのリクエストは Vite がバックエンドに転送します。

```sh
cd frontend
npm install               # 初回と、package.json が変わったときだけ
npm run dev               # フロントエンドを起動（http://localhost:5173）
```

テーブルはバックエンドの起動時に Flyway が `backend/src/main/resources/db/migration/` の SQL から自動で作ります。

### テストデータの投入と API の確認

バックエンドを一度起動してテーブルができたあとに、サンプルのカードを投入できます（既存のカードは消えます）。

```sh
docker compose exec -T db psql -U taskapp -d taskapp < backend/seed/sample-cards.sql
```

バックエンドを起動した状態で、API からカードを取得できます。

```sh
curl http://localhost:8080/api/cards      # カード一覧（リストの表示順 → リスト内の並び順）
curl http://localhost:8080/api/cards/1    # カード 1 件（存在しない id は 404）

# カードの追加（title だけ必須。listId を省略すると未着手の一番下に入る）
curl -X POST http://localhost:8080/api/cards \
  -H 'Content-Type: application/json' \
  -d '{"title": "課題A", "description": "第3章", "dueAt": "2026-10-08T18:00:00+09:00", "strict": true, "listId": "todo"}'
```

日時は UTC の ISO 8601 形式（例：`2026-10-09T15:47:41Z`）で返します。

止めるときは `docker compose down`（データは残る）。データも消すときは `docker compose down -v`。

### テスト

テストは Testcontainers で使い捨ての PostgreSQL を起動します。Colima の場合は次の環境変数が必要です。

```sh
export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
export TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock
cd backend && ./mvnw test
```

フロントエンドのテスト・チェックは `frontend/` で次を実行します。

```sh
npm test                  # Vitest（監視モード。1回だけなら npm test -- --run）
npm run lint              # oxlint
npm run format            # Prettier で整形
npm run build             # 型チェックとビルド
```
