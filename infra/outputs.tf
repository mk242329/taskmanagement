# terraform output で表示する値。scripts/deploy-*.sh もここから読む

output "app_url" {
  description = "アプリの URL"
  value       = "https://${aws_cloudfront_distribution.main.domain_name}"
}

output "region" {
  value = var.region
}

output "frontend_bucket" {
  description = "画面のファイルを置く S3 バケット"
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}

output "backend_function_name" {
  description = "バックエンドの Lambda 関数（scripts/deploy-backend.sh がコードを入れ替える）"
  value       = aws_lambda_function.backend.function_name
}
