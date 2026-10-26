# セキュリティグループ（サーバーごとのファイアウォール）
# EC2 の 8080 は CloudFront からだけ、RDS の 5432 は EC2 からだけ受け付ける。SSH は開けない

# AWS が管理している CloudFront の送信元 IP の一覧
data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

resource "aws_security_group" "backend" {
  name        = "${var.project}-backend"
  description = "Spring Boot on EC2: 8080 from CloudFront only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project}-backend" }
}

resource "aws_vpc_security_group_ingress_rule" "backend_from_cloudfront" {
  security_group_id = aws_security_group.backend.id
  description       = "API from CloudFront"
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
  ip_protocol       = "tcp"
  from_port         = 8080
  to_port           = 8080
}

# ECR からのイメージ取得・SSM・Secrets Manager への通信に使う
resource "aws_vpc_security_group_egress_rule" "backend_all" {
  security_group_id = aws_security_group.backend.id
  description       = "All outbound"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_security_group" "db" {
  name        = "${var.project}-db"
  description = "PostgreSQL: 5432 from the backend only"
  vpc_id      = aws_vpc.main.id
  tags        = { Name = "${var.project}-db" }
}

resource "aws_vpc_security_group_ingress_rule" "db_from_backend" {
  security_group_id            = aws_security_group.db.id
  description                  = "PostgreSQL from the backend"
  referenced_security_group_id = aws_security_group.backend.id
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
}
