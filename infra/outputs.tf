# terraform output で表示する値。scripts/deploy-*.sh もここから読む
# IP アドレスは EC2 を起動し直すと変わる。変わったら terraform apply -refresh-only で読み直す

output "app_url" {
  description = "アプリの URL"
  value       = "http://${aws_instance.app.public_ip}"
}

output "region" {
  value = var.region
}

output "instance_id" {
  description = "EC2 の ID（scripts/deploy-*.sh が今の IP アドレスを調べるのに使う）"
  value       = aws_instance.app.id
}

output "ssh_command" {
  description = "EC2 に SSH でログインするコマンド"
  value       = "ssh -i ${trimsuffix(var.ssh_public_key_path, ".pub")} ec2-user@${aws_instance.app.public_ip}"
}
