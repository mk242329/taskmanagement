# terraform output で表示する値。scripts/deploy-*.sh もここから読む

output "app_url" {
  description = "アプリの URL"
  value       = "http://${aws_eip.app.public_ip}"
}

output "region" {
  value = var.region
}

output "public_ip" {
  description = "EC2 の固定の IP アドレス（scripts/deploy-*.sh が SSH でつなぐ先）"
  value       = aws_eip.app.public_ip
}

output "ssh_command" {
  description = "EC2 に SSH でログインするコマンド"
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ec2-user@${aws_eip.app.public_ip}"
}
