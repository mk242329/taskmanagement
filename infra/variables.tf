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

variable "allowed_ips" {
  description = "画面を開いてよい IP アドレス（IPv4）の一覧。自宅の回線などは IP アドレスが変わることがあるので、そのときは書き換えて apply し直す"
  type        = list(string)

  validation {
    condition     = length(var.allowed_ips) > 0 && alltrue([for ip in var.allowed_ips : can(regex("^\\d{1,3}(\\.\\d{1,3}){3}$", ip))])
    error_message = "allowed_ips には IPv4 アドレス（例：203.0.113.10）を 1 つ以上書いてください。範囲（/24 など）は書けません。"
  }
}

variable "backend_memory_mb" {
  description = "バックエンドの Lambda のメモリ（MB）。増やすと CPU も増え、起動が速くなる"
  type        = number
  default     = 2048
}
