# バックエンド：Spring Boot を Lambda で動かす
# Lambda Web Adapter（AWS が公開しているレイヤー）が、受け取ったリクエストを Lambda の中の Spring Boot（8080）に HTTP で渡す。
# そのため、Spring Boot のコードは Lambda 用に書き換えずに動く。
# リクエストがないときは何も動かず、料金もかからない（最初のリクエストで起動するため、数秒待つことがある）

locals {
  backend_function_name = "${var.project}-backend"
  # Lambda Web Adapter のレイヤー（arm64 用）。https://github.com/awslabs/aws-lambda-web-adapter
  web_adapter_layer_arn = "arn:aws:lambda:${var.region}:753240598075:layer:LambdaAdapterLayerArm64:30"
}

# Lambda が使う IAM ロール：ログを書く・DynamoDB のテーブルを読み書きする
resource "aws_iam_role" "backend" {
  name = local.backend_function_name
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "backend" {
  name = "logs-and-dynamodb"
  role = aws_iam_role.backend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = "${aws_cloudwatch_log_group.backend.arn}:*"
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Scan",
        ]
        Resource = [aws_dynamodb_table.cards.arn, aws_dynamodb_table.counters.arn]
      },
    ]
  })
}

# ログの置き場所。ログは無料枠（月 5 GB）に収まるよう、7 日で消す
resource "aws_cloudwatch_log_group" "backend" {
  name              = "/aws/lambda/${local.backend_function_name}"
  retention_in_days = 7
}

# 最初に作るときだけ使う仮のコード。本物は scripts/deploy-backend.sh がアップロードする
data "archive_file" "backend_placeholder" {
  type        = "zip"
  output_path = "${path.module}/.terraform/backend-placeholder.zip"

  source {
    filename = "run.sh"
    content  = "#!/bin/bash\necho 'scripts/deploy-backend.sh でバックエンドをデプロイしてください' >&2\nexit 1\n"
  }
}

resource "aws_lambda_function" "backend" {
  function_name = local.backend_function_name
  role          = aws_iam_role.backend.arn
  runtime       = "java21"
  architectures = ["arm64"]
  # Lambda Web Adapter が実行する起動スクリプト（backend/lambda/run.sh）
  handler = "run.sh"
  layers  = [local.web_adapter_layer_arn]

  filename         = data.archive_file.backend_placeholder.output_path
  source_code_hash = data.archive_file.backend_placeholder.output_base64sha256

  # メモリを増やすと CPU も増え、起動が速くなる。無料枠は「メモリ（GB）× 秒」で月 40 万までなので、個人で使う分には十分収まる
  memory_size = var.backend_memory_mb
  timeout     = 30

  environment {
    variables = {
      AWS_LAMBDA_EXEC_WRAPPER = "/opt/bootstrap"
      # Spring Boot の起動を Lambda の初期化（10 秒まで）の外で待つ。起動に 10 秒以上かかっても失敗しない
      AWS_LWA_ASYNC_INIT     = "true"
      SPRING_PROFILES_ACTIVE = "aws"
      TASKAPP_CARDS_TABLE    = aws_dynamodb_table.cards.name
      TASKAPP_COUNTERS_TABLE = aws_dynamodb_table.counters.name
    }
  }

  lifecycle {
    # コードは scripts/deploy-backend.sh が入れ替えるので、Terraform では仮のコードに戻さない
    ignore_changes = [filename, source_code_hash]
  }

  depends_on = [aws_cloudwatch_log_group.backend, aws_iam_role_policy.backend]
}

# CloudFront から呼ぶための URL。AWS_IAM にして、署名のないリクエスト（CloudFront を通らないもの）は断る
resource "aws_lambda_function_url" "backend" {
  function_name      = aws_lambda_function.backend.function_name
  authorization_type = "AWS_IAM"
}

# この CloudFront のディストリビューションからだけ、関数 URL を呼べるようにする（2 つとも必要）
resource "aws_lambda_permission" "cloudfront_url" {
  statement_id           = "AllowCloudFrontInvokeFunctionUrl"
  action                 = "lambda:InvokeFunctionUrl"
  function_name          = aws_lambda_function.backend.function_name
  principal              = "cloudfront.amazonaws.com"
  source_arn             = aws_cloudfront_distribution.main.arn
  function_url_auth_type = "AWS_IAM"
}

resource "aws_lambda_permission" "cloudfront_invoke" {
  statement_id  = "AllowCloudFrontInvokeFunction"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.backend.function_name
  principal     = "cloudfront.amazonaws.com"
  source_arn    = aws_cloudfront_distribution.main.arn
}
