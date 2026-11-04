# アプリを動かす EC2：nginx が画面を配信し、/api は同じ EC2 の Spring Boot（8080）へ転送する
# （開発中の Vite の /api プロキシと同じ形）。データは DynamoDB に保存する

locals {
  app_name = "${var.project}-app"
}

# 新しく VPC は作らず、AWS が最初から用意しているデフォルトの VPC とサブネットを使う
data "aws_vpc" "default" {
  default = true
}

data "aws_subnet" "default" {
  vpc_id            = data.aws_vpc.default.id
  availability_zone = "${var.region}a"
  default_for_az    = true
}

# 自分の PC からだけ、SSH（22）と画面（80）につなげるようにする
resource "aws_security_group" "app" {
  name        = local.app_name
  description = "SSH and HTTP from allowed_ips only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [for ip in var.allowed_ips : "${ip}/32"]
  }

  ingress {
    description = "HTTP (nginx)"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [for ip in var.allowed_ips : "${ip}/32"]
  }

  # Java・nginx のインストールと、DynamoDB への接続に使う
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = local.app_name }
}

# EC2 が使う IAM ロール：DynamoDB のテーブルを読み書きする（アクセスキーを EC2 に置かずに済む）
resource "aws_iam_role" "app" {
  name = local.app_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "app" {
  name = "dynamodb"
  role = aws_iam_role.app.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Scan",
      ]
      Resource = [aws_dynamodb_table.cards.arn, aws_dynamodb_table.counters.arn]
    }]
  })
}

resource "aws_iam_instance_profile" "app" {
  name = local.app_name
  role = aws_iam_role.app.name
}

# SSH でログインするための鍵（公開鍵だけを AWS に登録する。秘密鍵は自分の PC から出さない）
resource "aws_key_pair" "app" {
  key_name   = local.app_name
  public_key = file(pathexpand(var.ssh_public_key_path))
}

# Amazon Linux 2023（arm64）の最新の AMI
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

resource "aws_instance" "app" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  subnet_id              = data.aws_subnet.default.id
  vpc_security_group_ids = [aws_security_group.app.id]
  iam_instance_profile   = aws_iam_instance_profile.app.name
  key_name               = aws_key_pair.app.key_name

  # IP アドレスは固定せず（Elastic IP は止めていても料金がかかる）、起動のたびに AWS が割り当てる
  associate_public_ip_address = true

  # CPU を決められた量より多く使ったときに、追加の料金がかからないようにする
  credit_specification {
    cpu_credits = "standard"
  }

  # IMDSv2 だけを許可する（インスタンスの認証情報を盗まれにくくする）
  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_type = "gp3"
    volume_size = 8
    encrypted   = true
  }

  # 最初の起動のときに、Java・nginx・Spring Boot の起動設定を入れる
  user_data = templatefile("${path.module}/templates/user-data.sh.tftpl", {
    region         = var.region
    cards_table    = aws_dynamodb_table.cards.name
    counters_table = aws_dynamodb_table.counters.name
  })

  # user-data の中身が変わったら、EC2 を作り直して反映する
  user_data_replace_on_change = true

  lifecycle {
    # 新しい AMI が出るたびに EC2 が作り直されないようにする
    ignore_changes = [ami]
  }

  tags = { Name = local.app_name }
}
