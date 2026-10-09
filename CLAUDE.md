# CLAUDE.md

このリポジトリで作業するときに Claude Code が必ず守るルールです。

## 開発フロー（厳守）

**どんなに小さな変更（typo 修正・ドキュメント更新を含む）でも、次の順番で進めること。例外はない。**

1. **イシューを作る**
   - 作業を始める前に、対応するイシューがあるか `gh issue list` で確認する。なければ `gh issue create` で作る。
   - タイトルは「何をするか」が分かる日本語にする。本文には「背景」「やること」「完了条件」を書く（`.github/ISSUE_TEMPLATE/` のテンプレートに従う）。
   - ラベルを 1 つ以上付ける（`enhancement` / `bug` / `documentation` など）。
2. **ブランチを作る**
   - 最新の main から切る：`git switch main && git pull --ff-only && git switch -c <ブランチ名>`
   - ブランチ名は下の「ブランチ命名規則」に従う。
3. **コミットする**
   - main ブランチ上では絶対にコミットしない。
4. **プッシュして PR を作る**
   - `git push -u origin <ブランチ名>` → `gh pr create`
   - PR 本文に `Closes #<イシュー番号>` を書き、マージ時にイシューが自動で閉じるようにする。
5. **マージ**
   - PR のマージはユーザーの確認を取ってから行う。Claude Code が勝手にマージしない。

### 禁止事項

- main ブランチへの直接コミット・直接プッシュ
- `git push --force` / `--force-with-lease` を main に対して行うこと
- イシューのないブランチ・PR を作ること
- GitHub のブランチ保護設定を外す・緩めること（ユーザーから明示的に頼まれた場合を除く）

main への直接コミット・プッシュは `.claude/hooks/guard-main-branch.sh` が機械的にブロックし、GitHub 側でもブランチ保護で拒否される。ブロックされたら回避策を探さず、上のフローに戻ること。

## 開発サーバーの起動（厳守）

バックエンドは **8080**、フロントエンドは **5173** で動かす。フロントエンドは `/api` を 8080 に転送しているため、ほかのポートで動かすと正しく動かない。

- サーバーの起動・再起動・停止は必ず `scripts/dev-start.sh`・`scripts/dev-stop.sh` で行う（手順は `.claude/skills/dev-servers/SKILL.md`）
- ポートが競合したら、**そのポートを使っているプロセスを止めて**、決められたポートで起動する。`scripts/dev-start.sh` はこれを自動で行う
- 別のポートで一時的に起動するのは禁止。`--port` や `server.port` で別の番号を指定したり、`vite.config.ts` の `strictPort` や `application.yml` のポートを変えたりしない
- 5432（PostgreSQL）は Colima がコンテナに転送しているため、そのプロセスは止めない

別のポートを指定した起動コマンドは `.claude/hooks/guard-dev-ports.sh` が機械的にブロックする。ブロックされたら回避策を探さず、`scripts/dev-start.sh` を使うこと。

## ブランチ命名規則

```
<種別>/<イシュー番号>-<内容を表す英語の短い説明>
```

| 種別 | 使う場面 |
|---|---|
| `feature` | 新しい機能の追加 |
| `fix` | バグ修正 |
| `docs` | ドキュメントだけの変更 |
| `refactor` | 動作を変えないコードの整理 |
| `test` | テストの追加・修正 |
| `chore` | 設定・ビルド・依存関係など上記以外 |

- 説明は英小文字とハイフンだけを使う（例：`feature/12-card-drag-and-drop`、`fix/15-overdue-color`、`docs/3-update-readme`）
- 1 つのブランチでは 1 つのイシューだけを扱う

## コミットメッセージ

- 日本語で「何をしたか」を 1 行で書く（既存の履歴に合わせる）
  - 例：`list・card テーブルの Flyway マイグレーションを追加`
- 必要なら 1 行空けて詳細を書く

## PR

- タイトルはイシューのタイトルに合わせる
- 本文は `.github/pull_request_template.md` に従い、「概要」「変更内容」「確認したこと」と `Closes #<番号>` を書く
- マージ方法は Squash and merge を基本とする。マージ後のブランチは GitHub が自動で削除する
