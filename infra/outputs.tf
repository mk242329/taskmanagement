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

output "ecr_repository_url" {
  description = "バックエンドのイメージの置き場所"
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_instance_id" {
  description = "バックエンドの EC2（aws ssm start-session --target で中に入れる）"
  value       = aws_instance.backend.id
}
