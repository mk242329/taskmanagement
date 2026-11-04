# RDS（PostgreSQL）：EC2 からだけ接続できるデータベース。
# アプリのデータは DynamoDB に置いているので、RDS は接続の確認だけに使う。
# 動かしているあいだ料金がかかる（無料枠の対象外）ため、ふだんは作らない。
# 確認するときだけ -var=enable_rds=true を付けて plan・apply し、終わったら付けずに apply して消す

locals {
  db_name = "${var.project}-db"
}

# RDS を置くサブネット。RDS は 2 つ以上のアベイラビリティゾーンのサブネットを求めるので、
# デフォルトの VPC のサブネットをすべて使う
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

resource "aws_db_subnet_group" "app" {
  count      = var.enable_rds ? 1 : 0
  name       = local.db_name
  subnet_ids = data.aws_subnets.default.ids
}

# EC2 のセキュリティグループが付いたものからの 5432 だけを通す（IP アドレスでは許可しない）
resource "aws_security_group" "db" {
  count       = var.enable_rds ? 1 : 0
  name        = local.db_name
  description = "PostgreSQL from the app EC2 only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = { Name = local.db_name }
}

resource "aws_db_instance" "app" {
  count          = var.enable_rds ? 1 : 0
  identifier     = local.db_name
  engine         = "postgres"
  engine_version = "18"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "taskapp"
  username = "taskapp"
  # パスワードは RDS が作って Secrets Manager に置く（コードにも state にも残らない）
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.app[0].name
  vpc_security_group_ids = [aws_security_group.db[0].id]
  # インターネットからつなぐためのアドレスを持たせない（VPC の中の EC2 からだけ届く）
  publicly_accessible = false

  # 1 台だけ・確認用なので、料金のかかる機能は使わない
  multi_az                = false
  backup_retention_period = 0
  # 確認が終わったらすぐ消せるようにする（消すときに最後のバックアップを取らない）
  skip_final_snapshot = true
  deletion_protection = false
  apply_immediately   = true
}
