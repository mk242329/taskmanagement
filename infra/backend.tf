# バックエンド：ECR（イメージ置き場）と、それを Docker で動かす EC2

resource "aws_ecr_repository" "backend" {
  name = "${var.project}-backend"
  # destroy のときにイメージが残っていても消せるようにする
  force_delete = true
}

# 古いイメージがたまらないよう、新しい 5 つだけ残す
resource "aws_ecr_lifecycle_policy" "backend" {
  repository = aws_ecr_repository.backend.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the latest 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

# EC2 が使う IAM ロール：SSM で操作される・ECR からイメージを取る・DB のパスワードを読む
resource "aws_iam_role" "backend" {
  name = "${var.project}-backend"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "backend_ssm" {
  role       = aws_iam_role.backend.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "backend_ecr" {
  role       = aws_iam_role.backend.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy" "backend_db_secret" {
  name = "read-db-secret"
  role = aws_iam_role.backend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_db_instance.main.master_user_secret[0].secret_arn
    }]
  })
}

resource "aws_iam_instance_profile" "backend" {
  name = "${var.project}-backend"
  role = aws_iam_role.backend.name
}

# Amazon Linux 2023（arm64）の最新の AMI
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

locals {
  # EC2 の中に置く、イメージを取り直してコンテナを起動し直すスクリプト
  restart_script = templatefile("${path.module}/templates/restart.sh.tftpl", {
    region        = var.region
    registry      = split("/", aws_ecr_repository.backend.repository_url)[0]
    image         = "${aws_ecr_repository.backend.repository_url}:latest"
    db_host       = aws_db_instance.main.address
    db_name       = aws_db_instance.main.db_name
    db_secret_arn = aws_db_instance.main.master_user_secret[0].secret_arn
  })
}

resource "aws_instance" "backend" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public[0].id
  vpc_security_group_ids = [aws_security_group.backend.id]
  iam_instance_profile   = aws_iam_instance_profile.backend.name

  # IMDSv2 だけを許可する（インスタンスの認証情報を盗まれにくくする）
  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  user_data = <<-EOF
    #!/bin/bash
    set -eux
    dnf install -y docker jq
    systemctl enable --now docker
    mkdir -p /opt/taskapp
    echo '${base64encode(local.restart_script)}' | base64 -d > /opt/taskapp/restart.sh
    chmod 700 /opt/taskapp/restart.sh
    # 初回はまだイメージが push されていないことがあるので、失敗しても止めない
    /opt/taskapp/restart.sh || true
  EOF

  # restart.sh の中身が変わったら、EC2 を作り直して反映する
  user_data_replace_on_change = true

  lifecycle {
    # 新しい AMI が出るたびに EC2 が作り直されないようにする
    ignore_changes = [ami]
  }

  tags = { Name = "${var.project}-backend" }
}

# EC2 を止めて起動し直してもアドレスが変わらないよう、固定の IP を付ける
resource "aws_eip" "backend" {
  instance = aws_instance.backend.id
  domain   = "vpc"
  tags     = { Name = "${var.project}-backend" }

  depends_on = [aws_internet_gateway.main]
}
