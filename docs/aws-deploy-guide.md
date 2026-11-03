# AWS デプロイ入門ガイド

作成日：2026年11月4日

AWS・Terraform を初めて使う人が、このアプリを AWS 上で動かすまでの手順と、その途中で出てくる言葉や考え方をまとめる。コマンドは Claude Code に実行してもらってかまわないが、何が起きているかはこのガイドで理解してから進める。

短い手順だけを見たいときは [README の「AWS へのデプロイ」](../README.md#aws-へのデプロイ) を参照する。

## 目次

1. [このガイドの前提](#1-このガイドの前提)
2. [AWS の基本](#2-aws-の基本)
3. [IaC と Terraform の基本](#3-iac-と-terraform-の基本)
4. [AWS CLI と認証の考え方](#4-aws-cli-と認証の考え方)
5. [認証の設定（初回だけ）](#5-認証の設定初回だけ)
6. [Claude Code に任せる範囲](#6-claude-code-に任せる範囲)
7. [初めてのデプロイ](#7-初めてのデプロイ)
8. [2 回目以降のデプロイ](#8-2-回目以降のデプロイ)
9. [困ったとき](#9-困ったとき)
10. [後片付け](#10-後片付け)

## 1. このガイドの前提

| 項目 | 内容 |
| --- | --- |
| 対象 | AWS・Terraform・IaC を使ったことがない人 |
| ゴール | ブラウザで CloudFront の URL を開き、Basic 認証のあとにボードが表示され、カードの追加・移動が保存される |
| 用意するもの | AWS アカウント（管理者の IAM ユーザーでコンソールにログインできる）、Mac、このリポジトリ |
| 必要なツール | AWS CLI v2、Terraform 1.10 以上、Docker（Colima）、Node.js 24（`brew install awscli hashicorp/tap/terraform`） |
| 所要時間 | 認証の設定に 30 分、初回のデプロイに 30 分ほど（うち 15 分ほどは AWS の作成待ち） |
| 費用 | 動かし続けると月 40 ドル前後（大半は RDS と EC2）。使わないときは [後片付け](#10-後片付け) で消す |

## 2. AWS の基本

### 2.1 クラウドと AWS

AWS（Amazon Web Services）は、サーバー・データベース・ストレージなどをインターネット越しに借りられるサービスである。自分のパソコンの代わりに、Amazon のデータセンターにあるコンピューターでアプリを動かす。

| 言葉 | 意味 |
| --- | --- |
| リージョン | データセンターのある地域。このアプリは東京（`ap-northeast-1`）を使う |
| アベイラビリティゾーン（AZ） | リージョンの中にある、独立したデータセンターの集まり。東京には複数ある |
| 従量課金 | 使った時間・量の分だけ料金がかかる。作ったまま放置すると料金がかかり続ける |
| 責任共有モデル | 建物や物理的な機械は AWS が守り、誰にアクセスを許すか・何を公開するかは利用者が守る |

### 2.2 このアプリで使うサービス

```mermaid
flowchart LR
    Browser[ブラウザ] --> CF[CloudFront<br>Basic 認証]
    CF -- "/api/* 以外" --> S3[(S3<br>画面)]
    CF -- "/api/*" --> EC2[EC2<br>Spring Boot]
    EC2 --> RDS[(RDS<br>PostgreSQL 17)]
    ECR[(ECR<br>イメージ置き場)] -. "イメージを取得" .-> EC2
```

| サービス | 役割 | 自分のパソコンでは |
| --- | --- | --- |
| CloudFront | 入口。HTTPS で受け付け、Basic 認証をかけ、`/api/*` は EC2 へ、それ以外は S3 へ振り分ける | Vite の開発サーバー（5173）の `/api` 転送 |
| S3 | ビルドした画面のファイル（HTML・JS・CSS）を置く場所 | `frontend/dist` |
| EC2 | 仮想サーバー。Docker で Spring Boot を動かす | `./mvnw spring-boot:run`（8080） |
| ECR | Docker イメージの置き場 | 手元の `docker images` |
| RDS | AWS が管理する PostgreSQL | Docker Compose の `postgres:17` |
| Secrets Manager | DB のパスワードを保管する。RDS が自動で作る | `application.yml` のパスワード |
| VPC・サブネット | 自分専用のネットワーク。RDS はインターネットから届かない「プライベートサブネット」に置く | 自分のパソコンの中 |
| セキュリティグループ | サーバーごとのファイアウォール。EC2 の 8080 は CloudFront からだけ、RDS の 5432 は EC2 からだけ通す | なし |
| IAM | 「誰が・何を・どこまでできるか」の権限の仕組み | なし |
| SSM（Systems Manager） | SSH を使わずに EC2 にコマンドを送ったり、中に入ったりする仕組み | なし |

### 2.3 IAM の言葉

| 言葉 | 意味 |
| --- | --- |
| ルートユーザー | アカウントを作ったメールアドレスでのログイン。何でもできるため、普段は使わない |
| IAM ユーザー | アカウントの中に作る利用者。長期間有効なアクセスキーを発行できる |
| IAM ロール | 一時的に借りる権限。EC2 は「ECR からイメージを取る」「DB のパスワードを読む」ロールを持つ（`infra/backend.tf`） |
| ポリシー | 許可する操作を書いたもの。ロールやユーザーに付ける |
| IAM Identity Center（SSO） | 人がログインして、短時間だけ有効な認証情報をもらう仕組み。このガイドではこれを使う |

## 3. IaC と Terraform の基本

### 3.1 IaC（Infrastructure as Code）とは

サーバーやネットワークなどのインフラを、マネジメントコンソールでクリックして作る代わりに、**コードに書いて作る** やり方である。

| | コンソールで手作業 | IaC（コード） |
| --- | --- | --- |
| 同じ環境をもう一度作る | 手順を思い出してやり直す | 同じコードを実行する |
| 何を変えたかの記録 | 残らない | Git の履歴に残る |
| 変更前の確認 | できない | `terraform plan` で事前に確認できる |
| レビュー | できない | PR でコードを見てもらえる |
| 消し忘れ | 起きやすい（料金がかかり続ける） | `terraform destroy` でまとめて消せる |
| AI に任せる | 画面操作は難しい | コードとコマンドなので任せやすい |

### 3.2 Terraform の仕組み

Terraform は IaC のツールで、`.tf` ファイルに「こうなっていてほしい状態」を書くと、今の状態との差を埋めるように AWS を操作する。

```mermaid
flowchart LR
    Code[".tf ファイル<br>あってほしい状態"] --> Plan["terraform plan<br>差を計算"]
    State[("state<br>Terraform が作ったものの記録")] --> Plan
    AWS[(AWS の実際の状態)] --> Plan
    Plan --> Apply["terraform apply<br>差を埋める"]
    Apply --> AWS
    Apply --> State
```

| 言葉 | 意味 | このリポジトリでは |
| --- | --- | --- |
| provider | どのサービスを操作するかのプラグイン | `hashicorp/aws`（`infra/versions.tf`） |
| resource | 作るもの 1 つ | `resource "aws_instance" "backend"` など |
| data | 作らずに読むだけのもの | 最新の Amazon Linux の AMI、CloudFront の IP 一覧など |
| variable | 外から渡す値 | `infra/variables.tf`。値は `terraform.tfvars` に書く |
| output | 作ったあとに表示する値 | `infra/outputs.tf`。URL や EC2 の ID。デプロイスクリプトもここから読む |
| state | Terraform が作ったものの記録（どの AWS のものがどの resource か） | S3 バケット `taskapp-tfstate-<アカウント ID>` に置く |
| lock | 2 人が同時に apply して state を壊さないための鍵 | `use_lockfile = true`（S3 にロックファイルを置く） |

state はパソコンに置くとなくしたときに Terraform が AWS の中身を把握できなくなるため、S3 に置き、過去の版も残している（`scripts/infra-init.sh`）。state には機密が入ることがあるので Git には入れない（`.gitignore`）。

### 3.3 基本のコマンド

| コマンド | すること | AWS が変わるか |
| --- | --- | --- |
| `terraform init` | provider をダウンロードし、state の置き場所につなぐ。最初に 1 回 | 変わらない |
| `terraform fmt` | `.tf` の書き方をそろえる | 変わらない |
| `terraform validate` | 書き方の誤りを調べる | 変わらない |
| `terraform plan` | 何が作られ・変わり・消えるかを表示する | 変わらない |
| `terraform apply` | plan の内容を実行する | **変わる** |
| `terraform output` | output の値を表示する | 変わらない |
| `terraform destroy` | 作ったものをすべて消す | **すべて消える** |

### 3.4 plan の読み方

```text
  + resource "aws_s3_bucket" "frontend" { ... }        # 作る
  ~ resource "aws_cloudfront_function" "basic_auth" {  # その場で変更する
  - resource "aws_eip" "backend" { ... }               # 消す
-/+ resource "aws_instance" "backend" { ... }          # 消してから作り直す

Plan: 1 to add, 1 to change, 1 to destroy.
```

`-` と `-/+` は特に注意する。RDS（`aws_db_instance.main`）が `-` か `-/+` になっていたら、**データベースの中身が消える**。分からないときは apply せずに Claude Code に理由を聞く。

### 3.5 `infra/` のファイル

| ファイル | 作るもの |
| --- | --- |
| `versions.tf` | Terraform・provider の版、state の置き場所、すべてに付けるタグ（`Project = taskapp`） |
| `variables.tf` | 変えられる値（リージョン、Basic 認証、EC2・RDS の大きさ） |
| `network.tf` | VPC、パブリック・プライベートサブネット（2 つの AZ）、インターネットへの経路 |
| `security.tf` | EC2 と RDS のセキュリティグループ |
| `database.tf` | RDS for PostgreSQL 17（パスワードは Secrets Manager が管理） |
| `backend.tf` | ECR、EC2 とその IAM ロール、固定 IP |
| `frontend.tf` | S3、CloudFront、Basic 認証の CloudFront Function |
| `outputs.tf` | URL などの表示する値 |
| `templates/` | Basic 認証のコード、EC2 でコンテナを起動し直すスクリプト |

## 4. AWS CLI と認証の考え方

### 4.1 AWS CLI とは

AWS CLI は、マネジメントコンソールでできる操作をターミナルのコマンドで行うツールである。Terraform も、内部では同じ API を呼んで AWS を操作している。どちらも「誰が操作しているか」を AWS に伝えるために **認証情報** が必要になる。

### 4.2 認証のやり方の比較

| やり方 | 認証情報 | 漏れたとき | このガイド |
| --- | --- | --- | --- |
| ルートユーザーのアクセスキー | 期限なし・全権限 | アカウントを乗っ取られる | 使わない |
| IAM ユーザーのアクセスキー（`aws configure`） | 期限なし。`~/.aws/credentials` に平文で保存 | 無効にするまで使われ続ける | 使わない |
| IAM Identity Center（`aws configure sso`） | ブラウザでログインして、数時間だけ有効なものを受け取る | 時間がたてば使えなくなる | **使う** |

アクセスキーはパソコンのファイルに残るため、うっかり Git に入れたり、AI ツールが読んだりする危険がある。Identity Center なら、パソコンに残るのは期限付きのトークンだけになる。

### 4.3 プロファイル

プロファイルは「どのアカウントに・どの権限で・どのリージョンでつなぐか」に名前を付けたもので、`~/.aws/config` に保存される。このリポジトリのスクリプトは **`taskapp`** という名前を使う（`AWS_PROFILE` で変えられる）。

## 5. 認証の設定（初回だけ）

CLI はまだ認証情報を持っていないので、ここだけはマネジメントコンソールを使う。インフラはこのあとすべて Terraform で作る。

### 5.1 アカウントを守る設定（コンソール）

1. ルートユーザーと、今使っている管理者の IAM ユーザーに MFA（スマートフォンの認証アプリ）が設定されているか確認する。なければ設定する
2. 「Billing and Cost Management」→「Budgets」で、月 50 ドルなどの予算を作り、超えそうなときにメールが届くようにする（思わぬ請求を防ぐ）

### 5.2 IAM Identity Center の準備（コンソール）

管理者の IAM ユーザーでログインして行う。

1. 右上のリージョンを「アジアパシフィック（東京）」にする
2. 「IAM Identity Center」を開き、「有効にする」を押す（組織で有効にするかを聞かれたら、組織のインスタンスを選ぶ）
3. 「ユーザー」→「ユーザーを追加」で、自分用のユーザーを作る（メールアドレスは自分のもの）
4. 「許可セット」→「許可セットを作成」→「事前定義された許可セット」で `AdministratorAccess` を選んで作る
   - Terraform は VPC・EC2・RDS・IAM ロールなどを作るため、学習用の個人アカウントでは管理者権限にしておくのが簡単である
5. 「AWS アカウント」→ 自分のアカウントを選び →「ユーザーまたはグループを割り当て」で、3 のユーザーと 4 の許可セットを割り当てる
6. 届いた招待メールからパスワードを設定し、MFA を登録する
7. 「設定」（または ダッシュボード）に表示される **AWS アクセスポータルの URL**（`https://d-xxxxxxxxxx.awsapps.com/start`）を控える

### 5.3 プロファイル `taskapp` を作る（ターミナル）

```bash
aws configure sso
```

質問に次のように答える。

| 質問 | 答え |
| --- | --- |
| `SSO session name (Recommended)` | `taskapp` |
| `SSO start URL` | 5.2 の 7 で控えた URL |
| `SSO region` | `ap-northeast-1` |
| `SSO registration scopes` | 何も入力せず Enter |

ブラウザが開くので、5.2 で作ったユーザーでログインして「許可」を押す。ターミナルに戻ると続きを聞かれる。

| 質問 | 答え |
| --- | --- |
| アカウントの選択 | 自分のアカウント（1 つだけなら自動で選ばれる） |
| ロールの選択 | `AdministratorAccess` |
| `Default client Region` | `ap-northeast-1` |
| `CLI default output format` | `json` |
| `Profile name` | `taskapp` |

### 5.4 つながったか確かめる

```bash
aws sts get-caller-identity --profile taskapp
```

`Account` に 12 桁のアカウント ID、`Arn` に `AWSReservedSSO_AdministratorAccess_...` が表示されれば成功である。

### 5.5 普段の使い方

認証情報は数時間で切れる。`Token has expired` や `Error when retrieving token from sso` が出たら、次を実行してブラウザで承認する（ブラウザの操作が要るので、Claude Code ではなく自分で実行する）。

```bash
aws sso login --profile taskapp
```

今まで IAM ユーザーのアクセスキーを `aws configure` で設定していた場合は、使わなくなったら IAM の画面でそのアクセスキーを無効化・削除しておく。

## 6. Claude Code に任せる範囲

AWS の操作は取り返しがつかないものがあるため、このリポジトリでは Claude Code が勝手に危ない操作をしないよう、`.claude/settings.json` で次のように決めている。

| 区分 | コマンド | 動き |
| --- | --- | --- |
| 自動で実行してよい | `terraform fmt`・`validate`・`plan`・`output`、`aws sts get-caller-identity` | 読むだけ・確認だけなので、確認なしで実行する |
| 実行前に確認する | `terraform apply`、`scripts/deploy-*.sh`、`aws s3 sync`、`aws ssm send-command` | AWS が変わるので、毎回ユーザーの許可を求める |
| 実行しない | `terraform destroy`、`apply -auto-approve`、`apply -destroy`、`state rm` | 必要なときはユーザーが自分で実行する |

あわせて [CLAUDE.md](../CLAUDE.md) で、`apply` の前に必ず `plan` を実行し、作成・変更・削除の件数と、削除・作り直しになるものを見せてから承認を取ることにしている。

頼み方の例：

- 「`terraform plan` を実行して、何が作られるか初心者向けに説明して」
- 「plan に `-/+` があるけど、なぜ作り直しになるの？」
- 「plan の内容で問題なければ apply して」
- 「バックエンドだけデプロイして」
- 「EC2 のコンテナのログを見て、エラーの原因を調べて」

## 7. 初めてのデプロイ

[5. 認証の設定](#5-認証の設定初回だけ) が終わっている前提で、リポジトリの一番上のフォルダで実行する。

### 7.1 ログインする

```bash
aws sso login --profile taskapp
```

### 7.2 Terraform を準備する

```bash
scripts/infra-init.sh
```

state を置く S3 バケット `taskapp-tfstate-<アカウント ID>` がなければ作り（過去の版を残す設定付き）、`terraform init` でそこにつなぐ。最初に 1 回だけ実行する。

### 7.3 Basic 認証のパスワードを決める

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
```

`infra/terraform.tfvars` を開き、`basic_auth_password` を 12 文字以上のパスワードに書き換える。このファイルは Git に入らない。

### 7.4 作られるものを確認する

```bash
cd infra
terraform plan -out=tfplan
```

初回はすべて新しく作るので `+` だけが並び、最後に `Plan: N to add, 0 to change, 0 to destroy.` と表示される。`-out=tfplan` で、確認した内容をそのまま次の apply に使えるよう保存する。

### 7.5 作る

```bash
terraform apply tfplan
```

15 分ほどかかる（RDS と CloudFront の作成待ち）。終わると `app_url` などの output が表示される。

### 7.6 アプリを載せる

```bash
cd ..
scripts/deploy-backend.sh
scripts/deploy-frontend.sh
```

| スクリプト | すること |
| --- | --- |
| `deploy-backend.sh` | バックエンドを arm64 の Docker イメージにビルドして ECR に置き、SSM で EC2 に「イメージを取り直してコンテナを起動し直す」よう命令する。起動時に Flyway がテーブルを作る |
| `deploy-frontend.sh` | 画面をビルドして S3 に置き、CloudFront に残っている古いファイル（キャッシュ）を消す |

### 7.7 開いて確かめる

最後に表示される URL（`https://xxxxxxxx.cloudfront.net`）をブラウザで開き、`terraform.tfvars` のユーザー名とパスワードでログインする。カードを追加・移動し、再読み込みしても残っていれば完成である。

## 8. 2 回目以降のデプロイ

| 変えたもの | すること |
| --- | --- |
| `backend/` | `scripts/deploy-backend.sh` |
| `frontend/` | `scripts/deploy-frontend.sh` |
| `infra/` | `terraform plan` → 内容を確認 → `terraform apply` |

どれも、先に `aws sso login --profile taskapp` でログインしておく。

## 9. 困ったとき

| 症状 | 原因と対処 |
| --- | --- |
| `Token has expired`、`Error when retrieving token from sso` | 認証が切れている。`aws sso login --profile taskapp` |
| `The config profile (taskapp) could not be found` | プロファイルがない。[5.3](#53-プロファイル-taskapp-を作るターミナル) をやり直す |
| `Backend initialization required` | `terraform init` がまだ。`scripts/infra-init.sh` |
| `basic_auth_password` の入力を求められる | `infra/terraform.tfvars` がない。[7.3](#73-basic-認証のパスワードを決める) |
| apply が途中で失敗した | できた分は state に記録されている。原因を直して、もう一度 `plan` → `apply` |
| `Saved plan is stale` | plan のあとに state が変わった。`terraform plan -out=tfplan` からやり直す |
| `docker build` が失敗する | Colima が止まっている。`colima start` |
| 画面は出るが API が 502・504 になる | バックエンドが起動していない。下の方法でログを見る |
| 画面が古いまま | CloudFront のキャッシュ。`scripts/deploy-frontend.sh` をもう一度実行する |

EC2 のログは、SSH ではなく SSM で中に入って見る。

```bash
aws ssm start-session --profile taskapp --target $(terraform -chdir=infra output -raw backend_instance_id)
sudo docker logs taskapp-backend
```

`start-session` を使うには Session Manager プラグインが必要である（`brew install --cask session-manager-plugin`）。

## 10. 後片付け

使わなくなったら、料金がかからないようにすべて消す。**DB のデータも消える**。Claude Code は実行しないので、自分で実行する。

```bash
cd infra
terraform destroy
```

削除されるものの一覧が表示されるので、確認してから `yes` と入力する。

最後に、Terraform の管理外である state 用のバケットを消す（版を残す設定にしているため、すべての版を消してからバケットを消す）。コンソールの S3 で `taskapp-tfstate-<アカウント ID>` を選び、「空にする」→「削除」を実行する。

数日後に「Billing and Cost Management」で、料金がかかり続けていないか確認する。「コスト配分タグ」で `Project` を有効にしておくと、Cost Explorer でタグ `Project = taskapp` に絞り込み、このアプリの分だけを見られる（有効にしてから反映まで 1 日ほどかかる）。
