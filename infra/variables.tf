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

variable "allowed_ips" {
  description = "SSH と画面につないでよい IP アドレス（IPv4）の一覧。自宅の回線などは IP アドレスが変わることがあるので、そのときは書き換えて apply し直す"
  type        = list(string)

  validation {
    condition     = length(var.allowed_ips) > 0 && alltrue([for ip in var.allowed_ips : can(regex("^\\d{1,3}(\\.\\d{1,3}){3}$", ip))])
    error_message = "allowed_ips には IPv4 アドレス（例：203.0.113.10）を 1 つ以上書いてください。範囲（/24 など）は書けません。"
  }
}

variable "instance_type" {
  description = "EC2 の種類。t4g.micro（arm64・メモリ 1 GB）は東京で月 8 ドルほど"
  type        = string
  default     = "t4g.micro"
}

variable "ssh_public_key_path" {
  description = "EC2 に登録する SSH の公開鍵のファイル"
  type        = string
  default     = "~/.ssh/taskapp-ec2.pub"
}
