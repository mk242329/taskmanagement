---
name: quality-check
description: このリポジトリの品質チェック（フロントエンドの lint・整形・テスト・ビルド、バックエンドのテスト、Terraform の fmt・validate・plan とセキュリティ・料金の確認、シェルスクリプトとドキュメントの確認）を行う。コミット・PR の前、「品質チェックして」「テストして」と頼まれたとき、infra/ や scripts/ を変えたときに使う。
---

# 品質チェック

コミット・PR の前に、変えたファイルに合わせて下のチェックを動かす。**どれか 1 つでも失敗したら、直してからやり直す。** 結果はユーザーに報告し、失敗を隠さない（パイプで `tail` などにつなぐと失敗が見えなくなるので、終了コードを確かめる）。

| 変えたもの | 動かすチェック |
|---|---|
| `frontend/` | [1. フロントエンド](#1-フロントエンド) |
| `backend/` | [2. バックエンド](#2-バックエンド) |
| `infra/` | [3. Terraform](#3-terraform) |
| `scripts/`・`.claude/hooks/` | [4. シェルスクリプト](#4-シェルスクリプト) |
| `*.md`（ドキュメント） | [5. ドキュメント](#5-ドキュメント) |

どれを変えたか分からないときは `git diff --name-only main...HEAD` と `git status --short` で確かめる。迷ったらすべて動かす。

## 1. フロントエンド

`frontend/` で実行する。CI（`.github/workflows/ci.yml`）と同じもの。

```sh
npm run lint                # oxlint
npx prettier --check .      # 整形。崩れていたら npm run format で直す
npm test -- --run           # Vitest（1 回だけ動かす）
npm run build               # 型チェックとビルド
```

## 2. バックエンド

テストは Testcontainers で DynamoDB Local を起動する。Colima では次の環境変数が要る（ないと「Docker の環境が見つからない」で失敗する）。先に `colima status` で Colima が動いているか確かめる。

```sh
cd backend
DOCKER_HOST=unix://$HOME/.colima/default/docker.sock \
TESTCONTAINERS_DOCKER_SOCKET_OVERRIDE=/var/run/docker.sock \
TESTCONTAINERS_RYUK_DISABLED=true \
./mvnw -B -q test
```

## 3. Terraform

`infra/` で実行する。plan は AWS を読むので、先に `aws sts get-caller-identity --profile taskapp` でログインを確かめる（`Token has expired` ならユーザーに `aws sso login --profile taskapp` を頼む）。

### 3.1 コマンドでのチェック

```sh
terraform fmt -check -recursive -diff    # 書き方。崩れていたら terraform fmt -recursive で直す
AWS_PROFILE=taskapp terraform validate   # 書き方の誤り・参照の誤り
AWS_PROFILE=taskapp terraform plan -lock=false -detailed-exitcode
```

plan の終了コードと、見ること：

| 終了コード | 意味 | 見ること |
|---|---|---|
| 0 | 差分なし（`No changes`） | AWS の実際の状態がコードとずれていない。**main の内容を変えていない PR ではこれが正しい** |
| 2 | 差分あり | `Plan:` の行で作成・変更・削除の件数を見て、`-`（削除）・`-/+`（作り直し）になるものを一覧にしてユーザーに見せる。意図しない差分があれば原因を調べる |
| 1 | エラー | エラーを直す |

- `Plan:` の行がなく `Changes to Outputs` だけのとき（EC2 を止めた・起動し直したので IP アドレスが変わったなど）も終了コードは 2 になる。AWS は変わらないので問題ない。差分の中身は `terraform plan -lock=false -no-color | grep -E 'will be\|must be\|Changes to Outputs\|Plan:'` で確かめる
- DynamoDB のテーブル（`aws_dynamodb_table.*`）が `-`・`-/+` になる変更は、**データがすべて消える**。必ずユーザーに伝える
- EC2（`aws_instance.app`）が `-/+` になると、送った jar と画面のファイルが消える。apply のあとにデプロイし直す必要があることを伝える
- `infra/rds.tf` を変えたときは、`-var=enable_rds=true` を付けた plan も動かし、RDS を作る側の設定も通ることを確かめる
- チェックの plan では apply しない。apply は CLAUDE.md の手順（plan を見せて承認を取る）で行う

### 3.2 コードを読んで確かめること

grep などで確かめる。当てはまるものがあれば、直すかユーザーに確認する。

| 観点 | 確かめること | 確かめ方の例 |
|---|---|---|
| 秘密を入れない | `terraform.tfvars`・state・plan のファイルが Git に入っていない。パスワードやアクセスキーを `.tf` に書いていない | `git ls-files infra \| grep -E 'tfvars$\|tfstate\|tfplan'`（何も出ないこと。`terraform.tfvars.example` は除く） |
| 公開しすぎない | セキュリティグループの ingress に `0.0.0.0/0`・`::/0` がない（使うのは egress だけ）。許可は `allowed_ips` か、別のセキュリティグループの ID で絞る | `grep -n -B8 '0.0.0.0/0' infra/*.tf` で ingress の中にないこと |
| DB を公開しない | RDS は `publicly_accessible = false` | `grep -n publicly_accessible infra/*.tf` |
| 暗号化 | EBS（`encrypted = true`）と RDS（`storage_encrypted = true`）のディスクを暗号化している | `grep -n -E 'encrypted' infra/*.tf` |
| EC2 の守り | IMDSv2 だけを許可している（`http_tokens = "required"`） | `grep -n http_tokens infra/*.tf` |
| 権限を絞る | IAM ポリシーの `Action`・`Resource` に `"*"` を使っていない。使う操作とテーブルだけを書く | `grep -n -E '"\*"\|:\*' infra/*.tf` |
| 料金 | 料金がかかるものを足していない（Elastic IP、NAT ゲートウェイ、ロードバランサー、RDS の常時起動、Multi-AZ など）。足すならユーザーに料金を伝えて承認を取る。EC2 の `cpu_credits = "standard"` を外していない | `grep -n -E 'aws_eip\|aws_nat_gateway\|aws_lb\|multi_az' infra/*.tf` |
| 消せること | 確認用の RDS は `deletion_protection = false`・`skip_final_snapshot = true` で、ふだんは作らない（`enable_rds` の既定値が `false`） | `grep -n -A3 'variable "enable_rds"' infra/variables.tf` |
| 版の固定 | provider を足したり版を変えたりしたら、`.terraform.lock.hcl` も更新してコミットする | `git status infra/.terraform.lock.hcl` |
| 読みやすさ | resource ごとに「何のためのものか」を日本語のコメントで書いている（既存のファイルに合わせる） | 目で見る |

`tflint` や `trivy` が入っていれば、あわせて動かしてよい（`tflint --chdir=infra`、`trivy config infra`）。入っていなければ、入れずに上の確認で済ませる。

## 4. シェルスクリプト

```sh
for f in scripts/*.sh .claude/hooks/*.sh; do bash -n "$f" || echo "NG: $f"; done   # 構文
bash -n infra/templates/user-data.sh.tftpl                                          # EC2 の起動スクリプト（テンプレート）
git ls-files -s scripts .claude/hooks                                               # 実行権限
```

- 直接実行するスクリプトは実行権限付き（`100755`）にする。`source` で読み込むだけのもの（`dev-common.sh`・`deploy-common.sh`）は、どちらでもよい
- `set -euo pipefail` を付けている
- パスワードなどの秘密を `echo` したり、コマンドの引数に入れたりしていない（標準入力で渡す。`scripts/rds-check.sh` を参考にする）
- `shellcheck` が入っていれば、あわせて動かしてよい

## 5. ドキュメント

リンク切れ（リンク先のファイルがない）を確かめる。リポジトリのルートで実行する。

```sh
python3 - <<'EOF'
import re, pathlib, subprocess
files = subprocess.run(["git", "ls-files", "*.md"], capture_output=True, text=True).stdout.split()
ng = 0
for f in files:
    p = pathlib.Path(f)
    for link in re.findall(r"\]\(([^)\s]+)\)", p.read_text()):
        target = link.split("#")[0]
        if not target or re.match(r"[a-z]+:", target):
            continue
        if not (p.parent / target).exists():
            print(f"NG: {f} -> {link}")
            ng += 1
print("リンク切れ:", ng)
EOF
```

あわせて次を確かめる。

- 消したファイル・名前を変えたファイルの名前が、ほかのファイルに残っていない（`git grep -n '<ファイル名>'`）
- 同じページの見出しへのリンク（`#...`）は、見出しを変えたときに直している
- 更新したドキュメントの冒頭の「更新日」を書き足している（既存のドキュメントに合わせる）
