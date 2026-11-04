# DynamoDB のテーブル
# キーの名前と型は backend の LocalTableCreator（ローカル用にテーブルを作る処理）とそろえる。
#
# 無料枠（Always Free）は「アカウント全体で読み込み 25・書き込み 25 のキャパシティユニットと 25 GB」まで。
# 使った分だけ払う「オンデマンド」は無料枠の対象外なので、決まった量を確保する「プロビジョンド」にする。
# 2 つのテーブルの合計（読み込み 12・書き込み 12）を 25 以下に収めている

# カード（1 枚が 1 つの項目。キーは id）
resource "aws_dynamodb_table" "cards" {
  name           = "${var.project}-cards"
  billing_mode   = "PROVISIONED"
  read_capacity  = 10
  write_capacity = 10
  hash_key       = "id"

  attribute {
    name = "id"
    type = "N"
  }

  # 学習用のため、terraform destroy で消せるようにしておく（消すとカードも消える）
  deletion_protection_enabled = false
}

# カードの id の連番（PostgreSQL の自動採番の代わり）
resource "aws_dynamodb_table" "counters" {
  name           = "${var.project}-counters"
  billing_mode   = "PROVISIONED"
  read_capacity  = 2
  write_capacity = 2
  hash_key       = "name"

  attribute {
    name = "name"
    type = "S"
  }

  deletion_protection_enabled = false
}
