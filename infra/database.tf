# RDS for PostgreSQL 17
# テーブルはバックエンドの起動時に Flyway が作る

resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "main" {
  identifier     = "${var.project}-db"
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "taskapp"
  username = "taskapp"
  # パスワードは AWS が生成して Secrets Manager に保管する。コードにも state にも残らない
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false

  backup_retention_period = 7

  # 学習用のため、terraform destroy で消せるようにしておく。
  # 消すとデータも消えるので、残したいときは destroy の前にスナップショットを取る
  deletion_protection = false
  skip_final_snapshot = true
}
