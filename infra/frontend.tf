# フロントエンドと入口：S3 にビルドした画面を置き、CloudFront で配信する。
# CloudFront は /api/* を Lambda（関数 URL）へ、それ以外を S3 へ振り分ける（Vite の /api プロキシと同じ形）

resource "aws_s3_bucket" "frontend" {
  # バケット名は世界で 1 つなので、アカウント ID を付ける
  bucket = "${var.project}-frontend-${data.aws_caller_identity.current.account_id}"
  # destroy のときに中身が残っていても消せるようにする
  force_destroy = true
}

# バケットは公開しない。CloudFront からだけ読めるようにする（下のバケットポリシー）
resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project}-frontend"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Lambda の関数 URL にも、CloudFront が署名を付けて転送する（署名のないリクエストは Lambda が断る）。
# 署名には本文の SHA-256 が要るため、画面は POST・PUT・PATCH に x-amz-content-sha256 ヘッダーを付ける（frontend/src/api/cards.ts）
resource "aws_cloudfront_origin_access_control" "backend" {
  name                              = "${var.project}-backend"
  origin_access_control_origin_type = "lambda"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.frontend.arn}/*"
      Condition = {
        StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.main.arn }
      }
    }]
  })
}

# ログイン機能のないアプリなので、入口で Basic 認証をかける
resource "aws_cloudfront_function" "basic_auth" {
  name    = "${var.project}-basic-auth"
  runtime = "cloudfront-js-2.0"
  publish = true
  code = templatefile("${path.module}/templates/basic-auth.js.tftpl", {
    credentials = base64encode("${var.basic_auth_user}:${var.basic_auth_password}")
  })
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# API にはクエリ文字列や Content-Type などをそのまま渡す（Host は関数 URL のものに差し替える）
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

locals {
  s3_origin_id  = "frontend-s3"
  api_origin_id = "backend-lambda"
  # 関数 URL（https://xxxx.lambda-url.ap-northeast-1.on.aws/）からドメイン名だけを取り出す
  api_domain = split("/", aws_lambda_function_url.backend.function_url)[2]
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "${var.project}: frontend (S3) + API (Lambda)"
  default_root_object = "index.html"
  # 日本を含む、北米・欧州・アジアの配信拠点を使う
  price_class = "PriceClass_200"

  origin {
    origin_id                = local.s3_origin_id
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    origin_id                = local.api_origin_id
    domain_name              = local.api_domain
    origin_access_control_id = aws_cloudfront_origin_access_control.backend.id

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # 画面（HTML・JS・CSS）
  default_cache_behavior {
    target_origin_id       = local.s3_origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.basic_auth.arn
    }
  }

  # API（キャッシュしない）
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = local.api_origin_id
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.basic_auth.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # 独自ドメインは使わず、CloudFront の *.cloudfront.net の証明書で HTTPS にする
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
