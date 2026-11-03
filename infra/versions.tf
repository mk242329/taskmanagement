# Terraform 本体と AWS プロバイダーの版、state の置き場所
terraform {
  required_version = ">= 1.10"

  # state は S3 に置く。バケット名はアカウントごとに違うため、
  # scripts/infra-init.sh が terraform init の -backend-config で渡す
  backend "s3" {
    key          = "taskapp/terraform.tfstate"
    region       = "ap-northeast-1"
    use_lockfile = true
  }

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region = var.region

  # 作ったものすべてに付ける印。請求をこのアプリの分だけに絞り込める
  default_tags {
    tags = {
      Project   = var.project
      ManagedBy = "terraform"
    }
  }
}

data "aws_caller_identity" "current" {}
