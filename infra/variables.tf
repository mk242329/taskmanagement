variable "project" {
  description = "リソース名の先頭に付ける名前"
  type        = string
  default     = "taskapp"
}

variable "region" {
  description = "使う AWS リージョン（東京）"
  type        = string
  default     = "ap-northeast-1"
}

variable "basic_auth_user" {
  description = "画面を開くときの Basic 認証のユーザー名"
  type        = string
  default     = "taskapp"
}

variable "basic_auth_password" {
  description = "画面を開くときの Basic 認証のパスワード。terraform.tfvars に書き、Git には入れない"
  type        = string
  sensitive   = true

  validation {
    condition     = length(var.basic_auth_password) >= 12
    error_message = "Basic 認証のパスワードは 12 文字以上にしてください。"
  }
}

variable "ec2_instance_type" {
  description = "バックエンドを動かす EC2 の大きさ（Graviton = arm64）"
  type        = string
  default     = "t4g.small"
}

variable "db_instance_class" {
  description = "RDS の大きさ"
  type        = string
  default     = "db.t4g.micro"
}
